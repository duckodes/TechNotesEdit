import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, deleteUser } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updatePassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import fetcher from "./fetcher.js";
import textareaUtils from "./textarea.utils.js";
import timer from "./timer.js";

const main = (async () => {
    const firebaseConfig = await fetcher.load('../res/config/firebaseConfig.json');
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const database = getDatabase(app);

    const techNotes = await get(ref(database, `technotes/data/${auth.currentUser?.uid}`));
    const dbEditor = document.getElementById('dbEditor');
    const manualEditor = document.getElementById('manualEditor');
    const addEntryBtn = document.getElementById('addEntryBtn');
    let data = !techNotes.val() ? {
        '無資料': [
            // {
            //     title: '標題',
            //     summary: '總結',
            //     content: '內容',
            //     images: [
            //         'https://www.duckode.com/img/duck/duck_192x_144p.png',
            //         'https://www.duckode.com/img/duck/duck_500x_144p.png'
            //     ],
            //     date: Date.now()
            // }
        ]
    } : techNotes.val();

    async function updateData() {
        const techNotes = await get(ref(database, `technotes/data/${auth.currentUser.uid}`));
        data = techNotes.val();
    }

    let userName;
    let isCreateAccount = false;

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            createLogin();
        } else {
            if (isCreateAccount) return;
            userName = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/name`))).val();
            await updateData();
            renderDBEditor();
            renderManualEditor();
            await renderChangeProfile();

            const containerLogout = document.createElement('div');
            containerLogout.className = 'logout-container';
            document.body.appendChild(containerLogout);
            const logoutButton = document.createElement('button');
            logoutButton.textContent = '登出';
            logoutButton.addEventListener('click', () => {
                signOut(auth)
                    .catch((error) => {
                        console.log(error);
                    });
                location.reload();
            });
            containerLogout.appendChild(logoutButton);
            const deleteAccountButton = document.createElement('button');
            deleteAccountButton.textContent = '刪除帳號';
            deleteAccountButton.addEventListener('click', async () => {
                if (!confirm('確定要刪除帳號嗎? 此操作無法復原')) return;
                const oldName = (await get(ref(database, `technotes/user/${user.uid}/name`))).val();
                const updates = {
                    [`/technotes/check/${oldName}`]: null
                };
                await update(ref(database), updates);
                await set(ref(database, `technotes/user/${user.uid}`), null);
                await set(ref(database, `technotes/data/${user.uid}`), null);
                await deleteUser(user);
                location.reload();
            });
            containerLogout.appendChild(deleteAccountButton);

            renderChangePassword();
            await expirationTime(user);
        }
    });
    async function expirationTime(user) {
        const timer = document.createElement('p');
        timer.textContent = new Date(Date.parse((await user.getIdTokenResult()).expirationTime)).toLocaleString() + ' 過期';
        document.body.insertBefore(timer, document.body.children[3]);
    }
    function createLogin() {
        const container = document.createElement('div');
        container.className = 'login-container';

        const title = document.createElement('h3');
        title.textContent = '登入';
        container.appendChild(title);

        const usernameLabel = document.createElement('label');
        usernameLabel.textContent = '帳號';
        container.appendChild(usernameLabel);

        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.placeholder = '輸入帳號';
        container.appendChild(usernameInput);

        const passwordLabel = document.createElement('label');
        passwordLabel.textContent = '密碼';
        container.appendChild(passwordLabel);

        const passwordInput = document.createElement('input');
        passwordInput.type = 'password';
        passwordInput.placeholder = '輸入密碼';
        container.appendChild(passwordInput);

        const loginStatus = document.createElement('div');
        loginStatus.className = 'login-status';
        loginStatus.textContent = '註冊';
        loginStatus.onclick = () => {
            if (loginStatus.textContent === '登入') {
                loginStatus.textContent = '註冊';
                title.textContent = '登入';
            } else {
                loginStatus.textContent = '登入';
                title.textContent = '註冊';
            }
        };
        container.appendChild(loginStatus);

        const button = document.createElement('button');
        button.textContent = '顯示輸入內容';
        container.appendChild(button);

        button.onclick = async () => {
            const email = usernameInput.value;
            const password = passwordInput.value;
            if (title.textContent === '登入') {
                signInWithEmailAndPassword(auth, email, password)
                    .then((userCredential) => {
                        const user = userCredential.user;
                        if (user) {
                            location.reload();
                        }
                    })
                    .catch((error) => {
                        const errorCode = error.code;
                        console.log(errorCode);
                    });
            } else {
                isCreateAccount = true;
                try {
                    const createUser = await createUserWithEmailAndPassword(auth, email, password);
                    const user = createUser.user;
                    const displayName = user.email.replace(/@.*?(?=@|$)/g, '');
                    await updateProfile(user, { displayName: displayName });

                    // check
                    await set(ref(database, `technotes/check/${displayName}`), user.uid);
                    // profile
                    await set(ref(database, `technotes/user/${user.uid}`), {
                        email: user.email,
                        employed: '',
                        github: '',
                        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8AABAAChQF3nAAAAABJRU5ErkJggg==',
                        name: displayName,
                        theme: 'default',
                        title: ''
                    })
                    title.textContent = '註冊成功';
                    await timer.delay(500);

                    location.reload();
                } catch (e) {
                    console.log(e);
                }
            }
        };
        const handleKey = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                button.click();
            }
        };
        passwordInput.addEventListener('focus', () => {
            passwordInput.addEventListener('keydown', handleKey);
        });
        passwordInput.addEventListener('blur', () => {
            passwordInput.removeEventListener('keydown', handleKey);
        });

        document.body.appendChild(container);
    }

    async function createEntryUI(item, container, isFromDB = false, index = null, category = null) {
        const entry = document.createElement('div');
        entry.className = 'entry';

        entry.innerHTML = `
            <div class="date">分類: <select class="recategory" style="margin-right: 10px;"></select> 第${index}筆資料</div>
            <br>
            
            <label>標題</label>
            <input type="text" value="${item.title}"><br>

            <label>總結</label>
            <textarea rows="2">${item.summary}</textarea><br>

            <label>內容</label>
            <div>
                <div class="content-tools">
                    <button class="disc-list-space">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32"><path fill="none" stroke="#ffffff" stroke-linecap="round" stroke-width="2" d="M12 8h15m-15 8h9m-9 8h15M7 24a1 1 0 1 1-2 0a1 1 0 0 1 2 0Zm0-8a1 1 0 1 1-2 0a1 1 0 0 1 2 0Zm0-8a1 1 0 1 1-2 0a1 1 0 0 1 2 0Z"></path></svg>
                    </button>
                    <button class="decimal-list-space">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><path fill="#ffffff" d="M224 120v16a8 8 0 0 1-8 8H104a8 8 0 0 1-8-8v-16a8 8 0 0 1 8-8h112a8 8 0 0 1 8 8Zm-8-72H104a8 8 0 0 0-8 8v16a8 8 0 0 0 8 8h112a8 8 0 0 0 8-8V56a8 8 0 0 0-8-8Zm0 128H104a8 8 0 0 0-8 8v16a8 8 0 0 0 8 8h112a8 8 0 0 0 8-8v-16a8 8 0 0 0-8-8ZM43.58 55.16L48 52.94V104a8 8 0 0 0 16 0V40a8 8 0 0 0-11.58-7.16l-16 8a8 8 0 0 0 7.16 14.32Zm36.19 101.56a23.73 23.73 0 0 0-9.6-15.95a24.86 24.86 0 0 0-34.11 4.7a23.63 23.63 0 0 0-3.57 6.46a8 8 0 1 0 15 5.47a7.84 7.84 0 0 1 1.18-2.13a8.76 8.76 0 0 1 12-1.59a7.91 7.91 0 0 1 3.26 5.32a7.64 7.64 0 0 1-1.57 5.78a1 1 0 0 0-.08.11l-28.69 38.32A8 8 0 0 0 40 216h32a8 8 0 0 0 0-16H56l19.08-25.53a23.47 23.47 0 0 0 4.69-17.75Z"></path></svg>
                    </button>
                    <button class="square-list-space">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="#ffffff" d="M1 4h2v2H1V4zm4 0h14v2H5V4zM1 9h2v2H1V9zm4 0h14v2H5V9zm-4 5h2v2H1v-2zm4 0h14v2H5v-2z"></path></svg>
                    </button>
                    <button class="circle-list-space">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20.438 6.062h-9a.5.5 0 0 1 0-1h9a.5.5 0 0 1 0 1Zm0 6.438h-9a.5.5 0 0 1 0-1h9a.5.5 0 0 1 0 1Zm0 6.435h-9a.5.5 0 1 1 0-1h9a.5.5 0 0 1 0 1ZM5.562 8.062a2.5 2.5 0 1 1 2.5-2.5a2.5 2.5 0 0 1-2.5 2.5Zm0-4a1.5 1.5 0 1 0 1.5 1.5a1.5 1.5 0 0 0-1.5-1.5Zm0 10.438a2.5 2.5 0 1 1 2.5-2.5a2.5 2.5 0 0 1-2.5 2.5Zm0-4a1.5 1.5 0 1 0 1.5 1.5a1.5 1.5 0 0 0-1.5-1.5Zm0 10.438a2.5 2.5 0 1 1 2.5-2.5a2.5 2.5 0 0 1-2.5 2.5Zm0-4a1.5 1.5 0 1 0 1.5 1.5a1.5 1.5 0 0 0-1.5-1.5Z"/></svg>
                    </button>
                    <button class="none-list-space">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16"><path fill="#ffffff" fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"></path></svg>
                    </button>
                    <button class="strong-space">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" fill="none">
                            <path d="M6 4V20M9.5 4H15.5C17.7091 4 19.5 5.79086 19.5 8C19.5 10.2091 17.7091 12 15.5 12H9.5H16.5C18.7091 12 20.5 13.7909 20.5 16C20.5 18.2091 18.7091 20 16.5 20H9.5M9.5 4V20M9.5 4H4M9.5 20H4" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="img-space">
                        <svg xmlns:x="http://ns.adobe.com/Extensibility/1.0/" xmlns:i="http://ns.adobe.com/AdobeIllustrator/10.0/" xmlns:graph="http://ns.adobe.com/Graphs/1.0/" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:a="http://ns.adobe.com/AdobeSVGViewerExtensions/3.0/" fill="#ffffff" version="1.1" baseProfile="tiny" id="Layer_1" width="20px" height="20px" viewBox="-0.5 0.5 42 42" xml:space="preserve">
                            <path d="M35.79,31.5c-0.05-0.04-5.181-7.971-6.72-7.971c-1.51,0-4.391,3.851-4.391,3.851c-2.24-2.31-7.2-8.87-8.661-8.87  c-1.509,0-7.449,8.12-10.789,12.99H35.79z M26.811,14.5c0,2.04,1.649,3.69,3.689,3.69s3.689-1.65,3.689-3.69s-1.649-3.69-3.689-3.69  S26.811,12.46,26.811,14.5z M0.5,7.5v27c0,2.52,0.51,3,3,3h34c2.471,0,3-0.46,3-3v-27c0-2.46-0.471-3-3-3h-34  C1.02,4.5,0.5,4.93,0.5,7.5z M3.5,7.5h34v27h-34V7.5z"/>
                        </svg>
                    </button>
                    <button class="span-space">
                        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="20px" height="20px" viewBox="0 0 32 32" xml:space="preserve">
                            <path fill="#ffffff" d="M4,4v24h24V4H4z M6,6h2.444L6,8.444V6z M6,11.272L11.272,6H14.1L6,14.101V11.272z M6,16.929  L16.929,6h2.828L6,19.757V16.929z M6,22.586L22.586,6h2.828L6,25.414V22.586z M26,26h-0.787L26,25.213V26z M26,22.385L22.385,26  h-2.828L26,19.556V22.385z M26,16.728L16.728,26h-2.828L26,13.899V16.728z M26,11.071L11.071,26H8.243L26,8.243V11.071z"/>
                        </svg>
                    </button>
                    <button class="p-space">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 25 25" fill="none">
                            <path d="M10 17.5H19M6 7.5H19M10 12.5H17M6.5 12V18" stroke="#ffffff" stroke-width="1.2"/>
                        </svg>
                    </button>
                    <button class="table-space">
                        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#ffffff" width="20px" height="20px" viewBox="0 0 36 36" version="1.1" preserveAspectRatio="xMidYMid meet">
                            <path d="M8,34a1,1,0,0,1-1-1V2.92a1,1,0,0,1,2,0V33A1,1,0,0,1,8,34Z" class="clr-i-outline clr-i-outline-path-1"/><path d="M17,33.92a1,1,0,0,1-1-1V9.1a1,1,0,1,1,2,0V32.92A1,1,0,0,1,17,33.92Z" class="clr-i-outline clr-i-outline-path-2"/><path d="M26,34a1,1,0,0,1-1-1V9a1,1,0,0,1,2,0V33A1,1,0,0,1,26,34Z" class="clr-i-outline clr-i-outline-path-3"/><path d="M33.11,18h-25a1,1,0,1,1,0-2h25a1,1,0,1,1,0,2Z" class="clr-i-outline clr-i-outline-path-4"/><path d="M33.1,26.94H8.1A1,1,0,1,1,8.1,25h25a1,1,0,1,1,0,1.92Z" class="clr-i-outline clr-i-outline-path-5"/><path d="M33,8.92H3A1,1,0,1,1,3,7H33a1,1,0,1,1,0,1.94Z" class="clr-i-outline clr-i-outline-path-6"/>
                            <rect x="0" y="0" width="36" height="36" fill-opacity="0"/>
                        </svg>
                    </button>
                    <button class="iframe-space">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="#ffffff" width="20px" height="20px" viewBox="0 0 24 24">
                            <path fill-rule="evenodd" d="M13,20 L20,20 L20,4 L4,4 L4,11 L11,11 C12.1045695,11 13,11.8954305 13,13 L13,20 Z M11,20 L11,13 L4,13 L4,20 L11,20 Z M4,2 L20,2 C21.1045695,2 22,2.8954305 22,4 L22,20 C22,21.1045695 21.1045695,22 20,22 L4,22 C2.8954305,22 2,21.1045695 2,20 L2,4 C2,2.8954305 2.8954305,2 4,2 Z"/>
                        </svg>
                    </button>
                    <button class="h1-space"><h1>A</h1></button>
                    <button class="h2-space"><h2>A</h2></button>
                    <button class="h3-space"><h3>A</h3></button>
                    <button class="h4-space"><h4>A</h4></button>
                    <button class="h5-space"><h5>A</h5></button>
                    <button class="h6-space"><h6>A</h6></button>
                    <button class="code-space">
                        <svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" fill="#ffffff" width="20" height="20" viewBox="0 0 30 30" version="1.1" id="svg822" inkscape:version="0.92.4 (f8dce91, 2019-08-02)" sodipodi:docname="code.svg">
                            <g transform="translate(0,-289.0625)">
                                <g aria-label="{}" style="font-style:normal;font-weight:normal;font-size:24.25199318px;line-height:1.25;font-family:sans-serif;letter-spacing:0px;word-spacing:0px;fill-opacity:1;stroke:none;stroke-width:1" id="text892">
                                    <path style="font-style:normal;font-variant:normal;font-weight:bold;font-stretch:normal;font-family:'Fira Code';-inkscape-font-specification:'Fira Code Bold';stroke-width:1.64934897" d="M 11.779297 3.1171875 C 7.3169299 3.1171875 5.618642 4.3052456 5.9824219 7.6035156 L 6.3476562 11.070312 C 6.5416723 12.889212 5.0614194 13.447266 3 13.447266 L 3 16.552734 C 5.0856714 16.552734 6.5416723 17.110797 6.3476562 18.929688 L 5.9824219 22.421875 C 5.642894 25.671645 7.3169299 26.882812 11.779297 26.882812 L 11.779297 24.214844 C 10.299925 24.214844 9.4021776 23.9001 9.5234375 22.6875 L 9.8867188 19.097656 C 10.177743 16.357176 8.7238695 15.38803 6.1289062 15 C 8.5783575 14.63622 10.177743 13.618564 9.8867188 10.902344 L 9.5234375 7.3125 C 9.4021776 6.0999 10.275673 5.7851562 11.779297 5.7851562 L 11.779297 3.1171875 z M 18.220703 3.1171875 L 18.220703 5.7851562 C 19.700075 5.7851562 20.597823 6.0999 20.476562 7.3125 L 20.113281 10.902344 C 19.822257 13.642814 21.30152 14.61197 23.896484 15 C 21.42278 15.36378 19.822257 16.381436 20.113281 19.097656 L 20.476562 22.6875 C 20.597822 23.9001 19.724327 24.214844 18.220703 24.214844 L 18.220703 26.882812 C 22.68307 26.882812 24.381358 25.694754 24.017578 22.396484 L 23.652344 18.929688 C 23.458328 17.110798 24.962832 16.552734 27 16.552734 L 27 13.447266 C 24.93858 13.447266 23.458328 12.889212 23.652344 11.070312 L 24.017578 7.578125 C 24.357106 4.328365 22.68307 3.1171875 18.220703 3.1171875 z " transform="translate(0,289.0625)" id="path894"/>
                                </g>
                            </g>
                        </svg>
                    </button>
                    <button class="a-space">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" fill="none">
                            <path d="M14 7H16C18.7614 7 21 9.23858 21 12C21 14.7614 18.7614 17 16 17H14M10 7H8C5.23858 7 3 9.23858 3 12C3 14.7614 5.23858 17 8 17H10M8 12H16" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
                <div class="content-display" contenteditable="true"></div>
                <textarea class="content-edit" rows="4">${item.content}</textarea><br>
            </div>

            <div class="content-begin-images">
                <label>內容開頭配圖</label>
                <div class="images"></div>
                <label>上傳圖片</label>
                <input type="file" id="fileInput" accept="image/*" />
                <div class="imageInputs"></div>
                <button class="addImageBtn">新增開頭配圖</button>
            </div>

            <div class="date">日期：${new Date(Number(item.date)).toLocaleString()}</div>
            
            <div id="tagInputContainer">
                <input type="text" class="tagInput" placeholder="輸入標籤後按 Enter">
                <button id="tagAdd">新增標籤</button>
            </div>
            <div id="suggestions"></div>
            <div id="tagList"></div>

            <div class="content-preview">
                <label>內容檢視</label>
                <input type="checkbox" class="content-input-preview"/>
            </div>
            ${!isFromDB ? '' : `<iframe class="preview-page" src="https://notes.duckode.com/?user=${userName}&category=${category}&categoryID=${index}" width="100%" height="600px" style="border:none;"></iframe>`}

            <button class="delete">刪除文章</button>
        `;

        window.addEventListener('message', (e) => {
            if (!contentInputPreview.checked) return;
            const params = new URLSearchParams(entry.querySelector('.preview-page')?.src);
            if (e.data.id !== params.get('category') + params.get('categoryID')) return;
            entry.querySelector('.preview-page').height = e.data.height + 'px';
        });
        let resizeTimer;
        let lastWidth = document.documentElement.clientWidth;
        const observer = new ResizeObserver(() => {
            if (!contentInputPreview.checked) return;
            const currentWidth = document.documentElement.clientWidth;

            if (currentWidth !== lastWidth) {
                if (!resizeTimer) {
                    const iframe = entry.querySelector('.preview-page');
                    if (iframe) {
                        iframe.style.visibility = 'hidden';
                    }
                }

                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    const iframe = entry.querySelector('.preview-page');
                    if (iframe) {
                        iframe.style.visibility = 'visible';
                        iframe.src = iframe.src;
                        resizeTimer = null;
                    }
                }, 500);
                lastWidth = currentWidth;
            }
        });
        observer.observe(document.documentElement);
        const contentInputPreview = entry.querySelector('.content-input-preview');
        if (!contentInputPreview.checked) {
            const iframe = entry.querySelector('.preview-page');
            if (iframe) {
                entry.querySelector('.preview-page').style.display = 'none';
            }
        }
        contentInputPreview.addEventListener('change', () => {
            const iframe = entry.querySelector('.preview-page');
            if (!iframe) return;
            if (contentInputPreview.checked) {
                iframe.style.display = '';
                iframe.src = iframe.src;
            } else {
                iframe.style.display = 'none';
            }
        });

        const fileInput = entry.querySelector('#fileInput');
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            await uploadImages(file);
        };

        const recategory = entry.querySelector('.recategory');
        Object.keys(data).forEach(dataCategory => {
            const option = document.createElement('option');
            option.value = dataCategory;
            option.textContent = dataCategory;
            if (dataCategory === category) {
                option.selected = true;
            }
            recategory.appendChild(option);
        });

        const dataState = {
            update: 0,
            upload: 1
        }
        if (isFromDB) {
            renderUploadBtn('更新', dataState.update);
        } else {
            renderUploadBtn('上傳', dataState.upload);
        }
        function renderUploadBtn(btnTextContent, state) {
            const uploadSingleBtn = document.createElement('button');
            uploadSingleBtn.textContent = btnTextContent;
            uploadSingleBtn.style.marginTop = '10px';
            uploadSingleBtn.onclick = async () => {
                const titleInput = entry.querySelector('input[type="text"]');
                const summaryTextarea = entry.querySelectorAll('textarea')[0];
                const contentTextarea = entry.querySelectorAll('textarea')[1];
                const imageInputs = entry.querySelectorAll('.imageInputs input');

                data[category][index].title = titleInput.value;
                data[category][index].summary = summaryTextarea.value;
                data[category][index].content = contentTextarea.value;
                data[category][index].images = Array.from(imageInputs).map(input => `https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/` + input.value);

                let confirmText = '';
                switch (state) {
                    case dataState.update:
                        confirmText = `確認更新資料\n類別: ${category}\n序列${index}\n\n標題: ${data[category][index].title}`;
                        break;
                    case dataState.upload:
                        confirmText = `確認上傳資料\n類別: ${category}\n序列${index}\n\n標題: ${data[category][index].title}`;
                        break;
                }
                if (confirm(confirmText)) {
                    const dateNow = Date.now();
                    state === dataState.upload && (data[category][index].date = dateNow);
                    await isTokenValid();
                    async function isTokenValid() {
                        if (!auth.currentUser) return false;

                        try {
                            const tokenResult = await auth.currentUser.getIdTokenResult();
                            const now = Date.now();
                            const exp = Date.parse(tokenResult.expirationTime);
                            return exp < now;
                        } catch (e) {
                            await relogin();
                            console.error("Token 判斷失敗", e);
                            return false;
                        }
                    }
                    async function relogin() {
                        alert("登入已過期，請重新登入");
                        const email = prompt("請輸入帳號或信箱");
                        const password = prompt("請輸入密碼");
                        if (!email || !password) {
                            alert("帳號或密碼未輸入完整");
                            return;
                        }
                        try {
                            await signInWithEmailAndPassword(auth, email, password);
                            alert("登入成功！");
                        } catch (error) {
                            alert("登入失敗：" + error.message);
                            return;
                        }
                    }
                    try {
                        async function moveNote(category, recategory, index) {
                            const noteToMove = data[category][index];

                            const categoryRef = ref(database, `technotes/data/${auth.currentUser.uid}/${category}`);
                            const snapshot = await get(categoryRef);
                            if (snapshot.exists()) {
                                const notesArray = Object.values(snapshot.val());
                                notesArray.splice(index, 1);
                                await set(categoryRef, notesArray);
                            }

                            const targetRef = ref(database, `technotes/data/${auth.currentUser.uid}/${recategory}`);
                            const targetSnapshot = await get(targetRef);
                            const nextIndex = targetSnapshot.exists() ? Object.keys(targetSnapshot.val()).length : 0;

                            await set(ref(database, `technotes/data/${auth.currentUser.uid}/${recategory.replaceAll('/', '／')}/${nextIndex}`), noteToMove);
                            console.log(`移動 ${category} ${index} 至 ${recategory} ${nextIndex}`);
                        }
                        if (recategory.value !== category) {
                            await moveNote(category, recategory.value, index);
                        } else {
                            await set(ref(database, `technotes/data/${auth.currentUser.uid}/${category.replaceAll('/', '／')}/${index}`), data[category][index]);
                            console.log(`已更新 ${category} ${index}：`, data[category][index]);
                        }
                        await setTags(tags);

                        // update main sitemap
                        const userId = auth.currentUser.uid;
                        const today = new Date().toISOString().split('T')[0]; // yyyy-mm-dd

                        const fileToInsert =
                            `    <url>
        <loc>https://notes.duckode.com/submodule/TechNotesSitemap/${userId}.xml</loc>
        <lastmod>${today}</lastmod>
    </url>`;
                        await pushSitemapToGitHub(fileToInsert);
                        const dataName = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/name`))).val();
                        await pushSitemapToGitHub(
                            `    <url>
        <loc>https://notes.duckode.com/?user=${dataName}&amp;category=${category.replaceAll('/', '／')}&amp;categoryID=${index}</loc>
        <lastmod>${today}</lastmod>
    </url>`, `${userId}.xml`);

                        dbEditor.innerHTML = '';
                        manualEditor.innerHTML = '';
                        await updateData();
                        renderDBEditor();
                        renderManualEditor();
                    } catch (error) {
                        alert("上傳失敗:" + error);
                        return;
                    }
                }
            };
            entry.appendChild(uploadSingleBtn);
        }

        container.appendChild(entry);

        const contentTextarea = entry.querySelectorAll('textarea')[1];
        const contentTools = entry.querySelector('.content-tools');
        contentTextarea.addEventListener('blur', () => {
            contentTools.style.display = '';

            renderContentDisplay();
            contentTextarea.style.display = '';
        });
        contentTools.childNodes.forEach(tool => {
            tool.addEventListener('pointerdown', (e) => {
                e.preventDefault();
            });
        });

        const contentDisplay = entry.querySelector('.content-display');
        renderContentDisplay();
        function renderContentDisplay() {
            contentDisplay.textContent = contentTextarea.value;
            convertSyntaxToHTML(contentDisplay);
            contentDisplay.style.display = '';
        }
        contentDisplay.addEventListener('pointerdown', (e) => {
            contentDisplay.style.display = 'none';
            contentTextarea.style.display = 'flex';
            contentTools.style.display = 'flex';
            setTimeout(() => {
                contentTextarea.focus();
            }, 0);
        });
        function convertSyntaxToHTML(element) {
            element.innerHTML = convertToTable(element.innerHTML);
            element.innerHTML = convertToLinksNewTab(element.innerHTML);
            element.innerHTML = convertToLinks(element.innerHTML);
            element.innerHTML = convertToImages(element.innerHTML);
            element.innerHTML = convertToHeadings(element.innerHTML);
            element.innerHTML = convertToStrong(element.innerHTML);
            element.innerHTML = convertToSpanWithSize(element.innerHTML);
            element.innerHTML = convertToParagraphWithSize(element.innerHTML);
            element.innerHTML = convertToCodeBlocks(element.innerHTML);
            element.innerHTML = convertToIframes(element.innerHTML);
            element.innerHTML = element.innerHTML.replace(/\n/g, "<br>");
            element.innerHTML = convertToListBlocks(element.innerHTML);
            entry.querySelectorAll('P').forEach(p => {
                if (p.nextSibling && p.nextSibling.nodeName === 'BR') {
                    p.nextSibling.remove();
                }
            });
            entry.querySelectorAll('ul').forEach(ul => {
                ul.querySelectorAll('br').forEach(br => br.remove());
                if (ul.previousSibling && ul.previousSibling.nodeName === 'BR') {
                    ul.previousSibling.remove();
                }
                if (ul.nextSibling && ul.nextSibling.nodeName === 'BR') {
                    ul.nextSibling.remove();
                }
            });
            entry.querySelectorAll('pre').forEach(pre => {
                if (pre.nextSibling && pre.nextSibling.nodeName === 'BR') {
                    pre.nextSibling.remove();
                }
            });


            function convertToTable(text) {
                return text.replace(
                    /(?:^|\n)(?:(?:[^\n]*\|[^\n]*)\n?){2,}/g,
                    match => {
                        // 檢查是否在 <pre> 或 <code> 區塊內（簡單防禦）
                        if (/<pre[\s\S]*?>[\s\S]*$/.test(text.split(match)[0]) &&
                            /<\/pre>/.test(text.split(match)[1])) {
                            return match; // 不處理 <pre> 內的內容
                        }

                        const rows = match.trim().split('\n');
                        const tableRows = rows.map((line, index) => {
                            const cleanedLine = line.trim().replace(/^(\|)+|(\|)+$/g, '');
                            const cells = cleanedLine.split('|').map(cell => cell.trim());
                            const tag = index === 0 ? 'th' : 'td';
                            const rowHtml = cells.map(cell => `<${tag}>${cell}</${tag}>`).join('');
                            return `<tr>${rowHtml}</tr>`;
                        });

                        return `<table>${tableRows.join('')}</table>`;
                    }
                );
            }
            function convertToLinks(text) {
                return text.replace(/\[a:([^\[\]]+)\[\[([\s\S]*?)\]\]\]/g, (match, href, content) => {
                    return `<a href="${href.trim()}">${content.trim()}</a>`;
                });
            }
            function convertToLinksNewTab(text) {
                return text.replace(/\[\+a:([^\[\]]+)\[\[([\s\S]*?)\]\]\]/g, (match, href, content) => {
                    return `<a href="${href.trim()}" target="_blank" rel="noopener noreferrer">${content.trim()}</a>`;
                });
            }
            function convertToImages(text) {
                return text.replace(/\[img:([^\[\]]+)\[\[([\s\S]*?)\]\]\]/g, (match, src, alt) => {
                    return `<img src="${src.trim()}" alt="${alt.trim()}" loading="lazy" />`;
                });
            }
            function convertToHeadings(text) {
                return text.replace(/\[(h[1-6])\[\[([\s\S]*?)\]\]\]/g, (match, tag, content) => {
                    return `<${tag}>${content.trim()}</${tag}>`;
                });
            }
            function convertToSpanWithSize(text) {
                return text
                    .replace(/\[span:(\d+)\[\[([\s\S]*?)\]\]\]/g, (match, size, content) => {
                        const fontSize = Math.min(parseInt(size, 10), 72);
                        return `<span style="font-size:${fontSize}px">${content.trim()}</span>`;
                    })
                    .replace(/\[span\[\[([\s\S]*?)\]\]\]/g, (match, content) => {
                        return `<span>${content.trim()}</span>`;
                    });
            }
            function convertToParagraphWithSize(text) {
                return text
                    .replace(/\[p:(\d+)\[\[([\s\S]*?)\]\]\]/g, (match, size, content) => {
                        const fontSize = Math.min(parseInt(size, 10), 72);
                        return `<p style="font-size:${fontSize}px">${content.trim()}</p>`;
                    })
                    .replace(/\[p\[\[([\s\S]*?)\]\]\]/g, (match, content) => {
                        return `<p>${content.trim()}</p>`;
                    });
            }
            function convertToStrong(text) {
                return text
                    .replace(/\[strong:(\d+)\[\[([\s\S]*?)\]\]\]/g, (match, size, content) => {
                        const fontSize = Math.min(parseInt(size, 10), 72);
                        return `<strong style="font-size:${fontSize}px">${content.trim()}</strong>`;
                    })
                    .replace(/\[strong\[\[([\s\S]*?)\]\]\]/g, (match, content) => {
                        return `<strong>${content.trim()}</strong>`;
                    });
            }
            function escapeHTML(str) {
                return str
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }
            function convertToCodeBlocks(text) {
                return text
                    .replace(/\[code:([^\[\]]+)\[\[([\s\S]*?)\]\]\]/g, (match, language, content) => {
                        return `<pre><code class="${language}">${content.trimStart().trimEnd()}</code></pre>`;
                    })
                    .replace(/\[code\[\[([\s\S]*?)\]\]\]/g, (match, content) => {
                        return `<pre><code>${content.trimStart().trimEnd()}</code></pre>`;
                    });
            }
            function convertToIframes(text) {
                return text.replace(/\(iframe:([^\[\]]+)\[\[([\s\S]*?)\]\]\)/g, (match, attrString, url) => {
                    const attrs = extractWidthHeight(attrString.trim());
                    return `<iframe ${attrs} src="${url.trim()}" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
                });
                function extractWidthHeight(attrString) {
                    const widthMatch = attrString.match(/width=["']([^"']+)["']/);
                    const heightMatch = attrString.match(/height=["']([^"']+)["']/);

                    const width = widthMatch ? `width="${escapeHTML(widthMatch[1])}"` : '';
                    const height = heightMatch ? `height="${escapeHTML(heightMatch[1])}"` : '';

                    return [width, height].filter(Boolean).join(' ');
                }
            }
            function convertToListBlocks(text) {
                function parseBlock(text) {
                    let i = 0;
                    const stack = [];
                    let output = '';

                    while (i < text.length) {
                        if (text.startsWith('[ul[[', i) || text.startsWith('[ol[[', i)) {
                            const type = text.startsWith('[ul[[', i) ? 'ul' : 'ol';
                            stack.push(type);
                            output += `<${type}>`;
                            i += 5;
                        } else if (text.startsWith('[li', i)) {
                            const liMatch = text.slice(i).match(/^\[li(?::([a-zA-Z\-]+))?\[\[/);
                            if (liMatch) {
                                const style = liMatch[1];
                                const styleAttr = style ? ` style="list-style-type:${style};"` : '';
                                stack.push('li');
                                output += `<li${styleAttr}>`;
                                i += liMatch[0].length;
                            } else {
                                i++;
                            }
                        } else if (text.startsWith(']]]', i)) {
                            const last = stack.pop();
                            output += `</${last}>`;
                            i += 3;
                        } else {
                            output += text[i];
                            i++;
                        }
                    }

                    return output;
                }

                return parseBlock(text.trim());
            }


        }

        const entryTextareas = entry.querySelectorAll("textarea");
        entryTextareas.forEach(textareaUtils.autoResizeTextarea);

        const entryDelete = entry.querySelector('.delete');
        entryDelete.onclick = async () => {
            if (confirm(`即將刪除資料\n類別: ${category}\n序列${index}\n\n標題: ${data[category][index].title}`)) {
                async function deleteNote(category, index) {
                    const categoryRef = ref(database, `technotes/data/${auth.currentUser.uid}/${category}`);
                    const snapshot = await get(categoryRef);
                    if (snapshot.exists()) {
                        const notesArray = Object.values(snapshot.val());
                        notesArray.splice(index, 1);
                        await set(categoryRef, notesArray);
                    }
                }
                dbEditor.innerHTML = '';
                manualEditor.innerHTML = '';
                await deleteNote(category, index);

                const dataName = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/name`))).val();
                await deleteUserFromSitemap(`https://notes.duckode.com/?user=${dataName}&amp;category=${category.replaceAll('/', '／')}&amp;categoryID=${index}`, `${auth.currentUser.uid}.xml`);
                await updateData();
                renderDBEditor();
                renderManualEditor();
            }
        };

        //#region 插入功能
        const entryCodeSpace = entry.querySelector('.code-space');
        let lastFocusedInput = null;
        document.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
                lastFocusedInput = e.target;
            }
        });
        document.addEventListener('focusout', (e) => {
            setTimeout(() => {
                if (!document.activeElement || document.activeElement === document.body) {
                    lastFocusedInput = null;
                }
            }, 0);
        });

        entryCodeSpace.onclick = (e) => {
            e.preventDefault();

            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '[code:language-csharp[[\n請放入代碼\n]]]',
                    '請放入代碼',
                    'csharp',
                    '請放入代碼'
                );
                contentTextarea.style.height = "auto";
            }

        };

        const entryASpace = entry.querySelector('.a-space');
        entryASpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '[+a:連結[[名稱]]]',
                    '名稱',
                    '連結',
                    '連結'
                );
                contentTextarea.style.height = "auto";
            }
        };

        const entryPSpace = entry.querySelector('.p-space');
        entryPSpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '[p:12[[引用文字]]]',
                    '引用文字',
                    '12',
                    '引用文字'
                );
                contentTextarea.style.height = "auto";
            }
        };

        const entrySpanSpace = entry.querySelector('.span-space');
        entrySpanSpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '[span:12[[文字]]]',
                    '文字',
                    '12',
                    '文字'
                );
                contentTextarea.style.height = "auto";
            }
        };

        const entryIframeSpace = entry.querySelector('.iframe-space');
        entryIframeSpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '(iframe:width="100%"[[連結]])',
                    '連結',
                    '100%',
                    '連結'
                );
                contentTextarea.style.height = "auto";
            }
        };

        const entryImgSpace = entry.querySelector('.img-space');
        entryImgSpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    `[img:https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/[[]]]`,
                    `https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/`,
                    `https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/`,
                    `https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/`
                );
                contentTextarea.style.height = "auto";
            }
        };

        const entryH1Space = entry.querySelector('.h1-space');
        entryH1Space.onclick = (e) => {
            headerSpace(e, 1);
        };
        const entryH2Space = entry.querySelector('.h2-space');
        entryH2Space.onclick = (e) => {
            headerSpace(e, 2);
        };
        const entryH3Space = entry.querySelector('.h3-space');
        entryH3Space.onclick = (e) => {
            headerSpace(e, 3);
        };
        const entryH4Space = entry.querySelector('.h4-space');
        entryH4Space.onclick = (e) => {
            headerSpace(e, 4);
        };
        const entryH5Space = entry.querySelector('.h5-space');
        entryH5Space.onclick = (e) => {
            headerSpace(e, 5);
        };
        const entryH6Space = entry.querySelector('.h6-space');
        entryH6Space.onclick = (e) => {
            headerSpace(e, 6);
        };
        function headerSpace(e, num) {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    `[h${num}[[文字]]]`,
                    '文字',
                    `${num}`,
                    '文字'
                );
                contentTextarea.style.height = "auto";
            }
        }

        const entryTableSpace = entry.querySelector('.table-space');
        entryTableSpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '|表格一|表格二|\n|內容一|內容二|',
                    '表格一',
                    '表格二',
                    '表格一'
                );
                contentTextarea.style.height = "auto";
            }
        };

        const entryStrongSpace = entry.querySelector('.strong-space');
        entryStrongSpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '[strong:12[[文字]]]',
                    '文字',
                    '12',
                    '文字'
                );
                contentTextarea.style.height = "auto";
            }
        };

        const discListSpace = entry.querySelector('.disc-list-space');
        discListSpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '[ul[[\n\u0020\u0020\u0020\u0020[li[[清單1]]]\n]]]',
                    '清單1',
                    '清單1',
                    '清單1'
                );
                contentTextarea.style.height = "auto";
            }
        };
        const decimalListSpace = entry.querySelector('.decimal-list-space');
        decimalListSpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '[ul[[\n\u0020\u0020\u0020\u0020[li:decimal[[清單1]]]\n]]]',
                    '清單1',
                    'decimal',
                    '清單1'
                );
                contentTextarea.style.height = "auto";
            }
        };
        const squareListSpace = entry.querySelector('.square-list-space');
        squareListSpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '[ul[[\n\u0020\u0020\u0020\u0020[li:square[[清單1]]]\n]]]',
                    '清單1',
                    'square',
                    '清單1'
                );
                contentTextarea.style.height = "auto";
            }
        };
        const circleListSpace = entry.querySelector('.circle-list-space');
        circleListSpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '[ul[[\n\u0020\u0020\u0020\u0020[li:circle[[清單1]]]\n]]]',
                    '清單1',
                    'circle',
                    '清單1'
                );
                contentTextarea.style.height = "auto";
            }
        };
        const noneListSpace = entry.querySelector('.none-list-space');
        noneListSpace.onclick = (e) => {
            e.preventDefault();
            if (lastFocusedInput) {
                insertSyntaxFlexible(
                    lastFocusedInput,
                    '[ul[[\n\u0020\u0020\u0020\u0020[li:none[[清單1]]]\n]]]',
                    '清單1',
                    'none',
                    '清單1'
                );
                contentTextarea.style.height = "auto";
            }
        };
        contentTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const textarea = e.target;
                const cursorPos = textarea.selectionStart;
                const text = textarea.value;

                const beforeCursor = text.slice(0, cursorPos);

                const liMatch = beforeCursor.match(/\[li:([^\[\]]+)\[\[.*?\]\]\]\s*$/);

                const ljMatch = beforeCursor.match(/\[li\[\[.*?\]\]\]\s*$/);

                if (liMatch || ljMatch) {
                    e.preventDefault();

                    let insertText = '';
                    if (liMatch) {
                        const tag = liMatch[1];
                        insertText = `\n    [li:${tag}[[文字]]]`;
                        insertSyntaxFlexible(
                            lastFocusedInput,
                            insertText,
                            '文字',
                            `${tag}`,
                            '文字'
                        );
                    } else if (ljMatch) {
                        insertText = `\n    [li[[文字]]]`;
                        insertSyntaxFlexible(
                            lastFocusedInput,
                            insertText,
                            '文字',
                            '文字',
                            '文字'
                        );
                    }
                    contentTextarea.style.height = "auto";
                }
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                const textarea = e.target;
                const value = textarea.value;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const spaces = '    '; // 4 個空格

                if (start === end) {
                    // 沒有選取文字
                    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                    const cursorInLine = start - lineStart;

                    if (e.shiftKey) {
                        // Shift + Tab：如果在行首，嘗試移除空格
                        const lineEnd = value.indexOf('\n', start);
                        const lineEndPos = lineEnd === -1 ? value.length : lineEnd;
                        const lineText = value.substring(lineStart, lineEndPos);
                        const match = lineText.match(/^ {1,4}/);
                        const removed = match ? match[0].length : 0;

                        if (removed > 0) {
                            const newLineText = lineText.replace(/^ {1,4}/, '');
                            const newText =
                                value.substring(0, lineStart) +
                                newLineText +
                                value.substring(lineEndPos);
                            textarea.value = newText;
                            textarea.selectionStart = textarea.selectionEnd = start - removed;
                        }
                    } else {
                        // Tab：如果光標在行首，縮排整行；否則插入空格
                        if (cursorInLine === 0) {
                            const lineEnd = value.indexOf('\n', start);
                            const lineEndPos = lineEnd === -1 ? value.length : lineEnd;
                            const lineText = value.substring(lineStart, lineEndPos);
                            const newLineText = spaces + lineText;
                            const newText =
                                value.substring(0, lineStart) +
                                newLineText +
                                value.substring(lineEndPos);
                            textarea.value = newText;
                            textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
                        } else {
                            // 插入空格
                            const newText =
                                value.substring(0, start) +
                                spaces +
                                value.substring(end);
                            textarea.value = newText;
                            textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
                        }
                    }
                } else {
                    // 有選取文字：照原本邏輯處理多行縮排
                    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                    const lineEnd = value.indexOf('\n', end);
                    const selectionEnd = lineEnd === -1 ? value.length : lineEnd;
                    const selectedText = value.substring(lineStart, selectionEnd);
                    const lines = selectedText.split('\n');

                    let modifiedLines = [];
                    let lineDeltas = [];
                    let totalDelta = 0;

                    if (e.shiftKey) {
                        modifiedLines = lines.map(line => {
                            const match = line.match(/^ {1,4}/);
                            const removed = match ? match[0].length : 0;
                            lineDeltas.push(-removed);
                            totalDelta -= removed;
                            return line.replace(/^ {1,4}/, '');
                        });
                    } else {
                        modifiedLines = lines.map(line => {
                            lineDeltas.push(spaces.length);
                            totalDelta += spaces.length;
                            return spaces + line;
                        });
                    }

                    const newText =
                        value.substring(0, lineStart) +
                        modifiedLines.join('\n') +
                        value.substring(selectionEnd);

                    textarea.value = newText;
                    textarea.selectionStart = start + lineDeltas[0];
                    textarea.selectionEnd = end + totalDelta;
                }
            }
        });
        function insertSyntaxFlexible(inputElement, syntaxTemplate, replaceTarget, selectTargetIfReplaced, selectTargetIfDefault) {
            const start = inputElement.selectionStart;
            const end = inputElement.selectionEnd;
            const originalText = inputElement.value;
            const selectedText = originalText.slice(start, end);

            const hasSelection = selectedText.length > 0;
            const replacedText = hasSelection ? selectedText : replaceTarget;
            const filledSyntax = syntaxTemplate.replace(replaceTarget, replacedText);

            inputElement.value =
                originalText.slice(0, start) +
                filledSyntax +
                originalText.slice(end);

            inputElement.focus();

            const insertedStart = start;
            const insertedEnd = start + filledSyntax.length;

            // 根據是否有選取，決定要選哪個 target
            const selectTarget = hasSelection ? selectTargetIfReplaced : selectTargetIfDefault;

            const selectIndexInFilled = filledSyntax.indexOf(selectTarget);
            const keywordStart = insertedStart + selectIndexInFilled;
            const keywordEnd = keywordStart + selectTarget.length;

            inputElement.setSelectionRange(keywordStart, keywordEnd);
        }
        //#endregion

        const imageInputsDiv = entry.querySelector('.imageInputs');
        const imagePreviewDiv = entry.querySelector('.images');
        const addImageBtn = entry.querySelector('.addImageBtn');

        function renderImages() {
            imageInputsDiv.innerHTML = '';
            imagePreviewDiv.innerHTML = '';

            item.images?.forEach(async (url, i) => {
                const selectImage = document.createElement('select');
                selectImage.style.marginRight = '10px';
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '請選擇圖片';
                selectImage.appendChild(defaultOption);
                const dataImages = await getImageFiles();
                Object.values(dataImages).forEach(dataImage => {
                    const option = document.createElement('option');
                    option.value = dataImage;
                    option.textContent = dataImage;
                    if (dataImage === url.replace(`https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/`, '')) {
                        option.selected = true;
                    }
                    selectImage.appendChild(option);
                });
                selectImage.onchange = () => {
                    input.value = selectImage.value;
                    item.images[i] = `https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/` + input.value;
                    renderImages();
                };

                const input = document.createElement('input');
                input.type = 'text';
                input.style.display = 'none';
                input.value = url.replace(`https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/`, '');
                input.style.width = '80%';
                input.onchange = () => {
                    item.images[i] = input.value;
                    renderImages();
                };

                const img = document.createElement('img');
                img.src = url;
                img.alt = `圖片${i + 1}`;
                img.style.height = '60px';
                img.style.marginLeft = '10px';

                const removeBtn = document.createElement('button');
                removeBtn.textContent = '刪除';
                removeBtn.onclick = () => {
                    item.images.splice(i, 1);
                    renderImages();
                    deleteFileFromGitHub(url.replace(`https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/`, ''));
                };

                const wrapper = document.createElement('div');
                wrapper.style.marginBottom = '10px';
                wrapper.appendChild(selectImage);
                wrapper.appendChild(input);
                wrapper.appendChild(img);
                wrapper.appendChild(removeBtn);

                imageInputsDiv.appendChild(wrapper);
                imagePreviewDiv.appendChild(img.cloneNode());
            });
        }

        addImageBtn.onclick = () => {
            (item.images ??= []).push('');
            renderImages();
        };

        renderImages();

        // 標籤
        const tagInput = entry.querySelector('.tagInput');
        const tagAdd = entry.querySelector('#tagAdd');
        const tagList = entry.querySelector('#tagList');
        const suggestionsBox = entry.querySelector('#suggestions');
        const tags = (await get(ref(database, `technotes/data/${auth.currentUser.uid}/${category}/${index}/tags`))).val() || [];
        renderTags();
        const allTags = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/tags`))).val() || [];

        tagInput.addEventListener('focus', showSuggestions);
        tagInput.addEventListener('input', showSuggestions);

        tagInput.addEventListener('blur', async () => {
            await timer.delay(200); // 保留點擊建議的時間
            suggestionsBox.innerHTML = '';
            suggestionsBox.style.display = '';
        });

        function showSuggestions() {
            suggestionsBox.style.display = 'block';
            const input = tagInput.value.trim().toLowerCase();
            suggestionsBox.innerHTML = '';

            const matched = allTags.filter(tag =>
                (!input || tag.toLowerCase().includes(input)) && !tags.includes(tag)
            );

            matched.forEach(tag => {
                const suggestion = document.createElement('div');
                suggestion.className = 'suggestion';
                suggestion.textContent = tag;
                suggestion.onclick = () => {
                    tags.push(tag);
                    renderTags();
                    tagInput.value = '';
                    suggestionsBox.innerHTML = '';
                };
                suggestionsBox.appendChild(suggestion);
                const removetags = document.createElement('div');
                removetags.textContent = 'x';
                removetags.onclick = async (e) => {
                    e.stopPropagation();
                    const updatedTags = allTags.filter(t => t !== tag);
                    await set(ref(database, `technotes/user/${auth.currentUser.uid}/tags`), updatedTags);
                    allTags.splice(allTags.indexOf(tag), 1);
                    showSuggestions();
                    if (confirm(`是否要一併從所有文章中移除標籤「${tag}」？`)) {
                        await removeTagFromAllArticles(tag);

                        dbEditor.innerHTML = '';
                        manualEditor.innerHTML = '';
                        await updateData();
                        renderDBEditor();
                        renderManualEditor();
                    }
                };
                suggestion.appendChild(removetags);
            });
        }

        tagAdd.addEventListener('click', () => {
            addTag();
        });
        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addTag();
            }
        });
        function addTag() {
            const newTag = tagInput.value.trim();
            if (newTag && !tags.includes(newTag)) {
                tags.push(newTag);
                renderTags();
            }
            tagInput.value = '';
            suggestionsBox.innerHTML = '';
        }

        function renderTags() {
            tagList.innerHTML = '';
            tags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'tag';
                tagEl.textContent = tag;

                const removeBtn = document.createElement('button');
                removeBtn.textContent = '×';
                removeBtn.onclick = () => {
                    tags.splice(tags.indexOf(tag), 1);
                    renderTags();
                };

                tagEl.appendChild(removeBtn);
                tagList.appendChild(tagEl);
            });
        }

        async function setTags(tags) {
            await set(ref(database, `technotes/data/${auth.currentUser.uid}/${category}/${index}/tags`), tags);

            const newTags = tags.filter(tag => !allTags.includes(tag));
            if (newTags.length > 0) {
                await set(ref(database, `technotes/user/${auth.currentUser.uid}/tags`), [...allTags, ...newTags]);
            }
        }
        async function removeTagFromAllArticles(tagToRemove) {
            const userId = auth.currentUser.uid;
            const dataPath = `technotes/data/${userId}`;

            const snapshot = await get(ref(database, dataPath));

            if (snapshot.exists()) {
                const articles = snapshot.val();

                for (const category in articles) {
                    for (const index in articles[category]) {
                        const article = articles[category][index];
                        const currentTags = article.tags || [];

                        if (currentTags.includes(tagToRemove)) {
                            const updatedTags = currentTags.filter(t => t !== tagToRemove);

                            await set(
                                ref(database, `${dataPath}/${category}/${index}/tags`),
                                updatedTags
                            );
                        }
                    }
                }

                console.log(`已從所有文章中移除標籤「${tagToRemove}」`);
            } else {
                console.warn('找不到任何文章資料');
            }
        }


    }

    function renderDBEditor() {
        dbEditor.innerHTML = '';

        if (!data) return;
        Object.entries(data).forEach(([category, items]) => {
            const categoryTitle = document.createElement('h3');
            categoryTitle.textContent = `主要分類：${category}`;
            dbEditor.appendChild(categoryTitle);

            items.forEach((item, index) => {
                createEntryUI(item, dbEditor, true, index, category);
            });
        });
    }

    function renderManualEditor() {
        const controlPanel = document.createElement('div');
        controlPanel.style.marginBottom = '20px';

        const categorySelect = document.createElement('select');
        categorySelect.id = 'categorySelect';
        categorySelect.style.marginRight = '10px';
        categorySelect.addEventListener('change', categorySelectChange);

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '請選擇分類';
        categorySelect.appendChild(defaultOption);

        if (data) {
            Object.keys(data).forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            });
        }

        const customCategoryInput = document.createElement('input');
        customCategoryInput.type = 'text';
        customCategoryInput.placeholder = '或輸入新分類';
        customCategoryInput.id = 'customCategoryInput';
        customCategoryInput.style.marginRight = '10px';
        function categorySelectChange(e) {
            if (e.target.selectedIndex === 0) return customCategoryInput.style.display = '';
            customCategoryInput.style.display = 'none';
        }

        addEntryBtn.textContent = '新增文章';
        addEntryBtn.id = 'addEntryBtn';

        controlPanel.appendChild(categorySelect);
        controlPanel.appendChild(customCategoryInput);
        controlPanel.appendChild(addEntryBtn);

        manualEditor.appendChild(controlPanel);

        addEntryBtn.onclick = () => {
            const selectedCategory = categorySelect.value.trim();
            const customCategory = customCategoryInput.value.trim();
            const finalCategory = customCategory || selectedCategory;

            if (!finalCategory) {
                alert("請選擇或輸入分類");
                return;
            }

            const newItem = {
                title: '',
                summary: '',
                content: '',
                images: [],
                date: Date.now()
            };

            if (data) {
                if (!data[finalCategory]) {
                    data[finalCategory] = [];

                    const newOption = document.createElement('option');
                    newOption.value = finalCategory;
                    newOption.textContent = finalCategory;
                    categorySelect.appendChild(newOption);
                }

                data[finalCategory].push(newItem);

                createEntryUI(newItem, manualEditor, false, data[finalCategory].length - 1, finalCategory);
            } else {
                const newOption = document.createElement('option');
                newOption.value = finalCategory;
                newOption.textContent = finalCategory;
                categorySelect.appendChild(newOption);

                data = {
                    [finalCategory]: [newItem]
                };

                createEntryUI(newItem, manualEditor, false, data[finalCategory].length - 1, finalCategory);
            }

        };
    }

    function renderChangePassword() {
        const container = document.createElement('div');
        container.className = 'change-password-container';

        const title = document.createElement('h3');
        title.textContent = '更新密碼';
        container.appendChild(title);

        const input = document.createElement('input');
        input.type = 'password';
        input.placeholder = '輸入新密碼';
        input.style.marginRight = "10px";
        container.appendChild(input);

        const inputCheck = document.createElement('input');
        inputCheck.type = 'password';
        inputCheck.placeholder = '確認新密碼';
        inputCheck.style.marginRight = "10px";
        container.appendChild(inputCheck);

        const button = document.createElement('button');
        button.textContent = '更新';
        container.appendChild(button);

        const status = document.createElement('p');
        status.style.marginTop = '10px';
        container.appendChild(status);

        document.body.appendChild(container);

        button.addEventListener('click', async () => {
            const newPassword = input.value;
            const checkPassword = inputCheck.value;
            const user = auth.currentUser;

            if (!user) {
                status.textContent = '尚未登入，無法更新密碼';
                return;
            }

            if (newPassword !== checkPassword) {
                status.textContent = '密碼不一致，請重新輸入';
                return;
            }

            if (!confirm('確定要更新密碼嗎?')) {
                status.textContent = '操作已取消';
                return;
            }

            updatePassword(user, newPassword)
                .then(() => {
                    status.textContent = '密碼更新成功';
                })
                .catch((error) => {
                    status.textContent = '更新失敗：' + error.message;
                });
            await timer.delay(3000);
            status.textContent = '';
        });

    }

    //#region 更換個人資訊
    async function renderChangeProfile() {
        async function isTokenValid() {
            if (!auth.currentUser) return false;

            try {
                const tokenResult = await auth.currentUser.getIdTokenResult();
                const now = Date.now();
                const exp = Date.parse(tokenResult.expirationTime);
                return exp < now;
            } catch (e) {
                await relogin();
                console.error("Token 判斷失敗", e);
                return false;
            }
        }
        async function relogin() {
            alert("登入已過期，請重新登入");
            const email = prompt("請輸入帳號或信箱");
            const password = prompt("請輸入密碼");
            if (!email || !password) {
                alert("帳號或密碼未輸入完整");
                return;
            }
            try {
                await signInWithEmailAndPassword(auth, email, password);
                alert("登入成功！");
            } catch (error) {
                alert("登入失敗：" + error.message);
                return;
            }
        }

        const dataTopic = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/topic`))).val();
        const dataImage = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/image`))).val();
        const dataName = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/name`))).val();
        const dataTitle = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/title`))).val();
        const dataEmployed = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/employed`))).val();
        const dataEmail = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/email`))).val();
        const dataGithub = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/github`))).val();
        const dataTheme = (await get(ref(database, `technotes/user/${auth.currentUser.uid}/theme`))).val();

        const container = document.createElement('div');
        container.className = 'profile-container';

        const title = document.createElement('h3');
        title.innerHTML = '個人資訊 <a href="https://notes.duckode.com/?user=' + dataName + '" style="font-size: 12px;color: #000;" target="_blank">發布連結</a>';
        container.appendChild(title);

        const status = document.createElement('p');
        status.style.marginTop = '10px';

        const inputTopic = document.createElement('input');
        inputTopic.placeholder = `輸入新主旨(${dataTopic || '尚未設定'})`;
        container.appendChild(inputTopic);
        const buttonTopic = document.createElement('button');
        buttonTopic.textContent = '更新主旨';
        container.appendChild(buttonTopic);
        buttonTopic.onclick = async () => {
            await isTokenValid();
            if (!confirm(`確定要更新主旨?${inputTopic.value}`)) return;
            try {
                await set(ref(database, `technotes/user/${auth.currentUser.uid}/topic`), inputTopic.value);
                status.textContent = '已更新主旨';
            } catch (e) {
                status.textContent = `更新主旨失敗: ${e}`;
            }
        };

        const containerImage = document.createElement('div');
        const selectImage = document.createElement('select');
        selectImage.style.marginRight = '10px';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '請選擇圖片';
        selectImage.appendChild(defaultOption);
        const avatarImage = document.createElement('img');
        const githubImages = await getImageFiles();
        Object.values(githubImages).forEach(githubImage => {
            const option = document.createElement('option');
            option.value = githubImage;
            option.textContent = githubImage;
            if (githubImage === dataImage.replace(`https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/`, '')) {
                option.selected = true;
                avatarImage.src = `https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/` + githubImage;
            }
            selectImage.appendChild(option);
        });
        selectImage.onchange = () => {
            avatarImage.src = `https://duckodes.github.io/TechNotesPicture/${auth.currentUser.uid}/` + selectImage.value;
        };
        containerImage.appendChild(selectImage);
        containerImage.appendChild(avatarImage);
        const buttonImage = document.createElement('button');
        buttonImage.textContent = '更新頭貼';
        containerImage.appendChild(buttonImage);
        buttonImage.onclick = async () => {
            await isTokenValid();
            if (!confirm('確定要更新頭貼?')) return;
            try {
                await set(ref(database, `technotes/user/${auth.currentUser.uid}/image`), avatarImage.src);
                status.textContent = '已更新頭貼';
            } catch (e) {
                status.textContent = `更新頭貼失敗: ${e}`;
            }
        };
        container.appendChild(containerImage);
        const uploadImageInput = document.createElement('input');
        uploadImageInput.type = 'file';
        uploadImageInput.accept = 'image/*';
        uploadImageInput.onchange = async (e) => {
            const file = e.target.files[0];
            await uploadImages(file);
        }
        container.appendChild(uploadImageInput);

        const selectTheme = document.createElement('select');
        selectTheme.style.marginRight = '10px';
        const themes = await fetcher.load('https://notes.duckode.com/res/config/themes.json');
        if (themes) {
            Object.values(themes).forEach(theme => {
                const option = document.createElement('option');
                option.value = theme;
                option.textContent = theme;
                if (theme === dataTheme) {
                    option.selected = true;
                }
                selectTheme.appendChild(option);
            });
            container.appendChild(selectTheme);
            const buttonTheme = document.createElement('button');
            buttonTheme.textContent = '更新主題';
            container.appendChild(buttonTheme);
            buttonTheme.onclick = async () => {
                await isTokenValid();
                if (!confirm('確定要更新主體?')) return;
                try {
                    await set(ref(database, `technotes/user/${auth.currentUser.uid}/theme`), selectTheme.value);
                    status.textContent = '已更新主題';
                    alert('已更新主題為 ' + selectTheme.value);
                } catch (e) {
                    status.textContent = `更新主題失敗: ${e}`;
                }
            };
        }

        const inputName = document.createElement('input');
        inputName.type = 'text';
        inputName.placeholder = `輸入新名稱(${dataName || '尚未設定'})`;
        inputName.style.marginRight = "10px";
        container.appendChild(inputName);
        const buttonName = document.createElement('button');
        buttonName.textContent = '更新名稱';
        container.appendChild(buttonName);

        const inputTitle = document.createElement('input');
        inputTitle.type = 'text';
        inputTitle.placeholder = `輸入職稱(${dataTitle || '尚未設定'})`;
        inputTitle.style.marginRight = "10px";
        container.appendChild(inputTitle);
        const buttonTitle = document.createElement('button');
        buttonTitle.textContent = '更新職稱';
        container.appendChild(buttonTitle);
        buttonTitle.onclick = async () => {
            await isTokenValid();
            if (!confirm('確定要更新職稱?')) return;
            try {
                const titleRef = ref(database, `technotes/user/${auth.currentUser.uid}/title`);
                await set(titleRef, inputTitle.value);
                inputTitle.placeholder = `輸入新職稱(${(await get(titleRef)).val()})`;
                inputTitle.value = '';
                status.textContent = '已更新職稱';
            } catch (e) {
                status.textContent = `更新職稱失敗: ${e}`;
            }
        };

        const inputEmployed = document.createElement('input');
        inputEmployed.type = 'text';
        inputEmployed.placeholder = `輸入職位資訊(${dataEmployed || '尚未設定'})`;
        inputEmployed.style.marginRight = "10px";
        container.appendChild(inputEmployed);
        const buttonEmployed = document.createElement('button');
        buttonEmployed.textContent = '更新職位資訊';
        container.appendChild(buttonEmployed);
        buttonEmployed.onclick = async () => {
            await isTokenValid();
            if (!confirm('確定要更新職位資訊?')) return;
            try {
                const employedRef = ref(database, `technotes/user/${auth.currentUser.uid}/employed`);
                await set(employedRef, inputEmployed.value);
                inputEmployed.placeholder = `輸入新職位(${(await get(employedRef)).val()})`;
                inputEmployed.value = '';
                status.textContent = '已更新職位';
            } catch (e) {
                status.textContent = `更新職位失敗: ${e}`;
            }
        };

        const inputEmail = document.createElement('input');
        inputEmail.type = 'text';
        inputEmail.placeholder = `輸入新信箱資訊(${dataEmail || '尚未設定'})`;
        inputEmail.style.marginRight = "10px";
        container.appendChild(inputEmail);
        const buttonEmail = document.createElement('button');
        buttonEmail.textContent = '更新信箱';
        container.appendChild(buttonEmail);
        buttonEmail.onclick = async () => {
            await isTokenValid();
            if (!confirm('確定要更新信箱?')) return;
            try {
                const emailRef = ref(database, `technotes/user/${auth.currentUser.uid}/email`);
                await set(emailRef, inputEmail.value);
                inputEmail.placeholder = `輸入新信箱(${(await get(emailRef)).val()})`;
                inputEmail.value = '';
                status.textContent = '已更新信箱';
            } catch (e) {
                status.textContent = `更新信箱失敗: ${e}`;
            }
        };

        const inputGithub = document.createElement('input');
        inputGithub.type = 'text';
        inputGithub.placeholder = `輸入 Github 連結(${dataGithub || '尚未設定'})`;
        inputGithub.style.marginRight = "10px";
        container.appendChild(inputGithub);
        const buttonGithub = document.createElement('button');
        buttonGithub.textContent = '更新 Github 連結';
        container.appendChild(buttonGithub);
        buttonGithub.onclick = async () => {
            await isTokenValid();
            if (!confirm('確定要更新Github連結?')) return;
            try {
                const githubRef = ref(database, `technotes/user/${auth.currentUser.uid}/github`);
                await set(githubRef, inputGithub.value);
                inputGithub.placeholder = `輸入 Github 連結(${(await get(githubRef)).val()})`;
                inputGithub.value = '';
                status.textContent = '已更新 Github 連結';
            } catch (e) {
                status.textContent = `更新 Github 連結失敗: ${e}`;
            }
        };

        container.appendChild(status);

        dbEditor.parentNode.insertBefore(container, dbEditor);

        buttonName.addEventListener('click', async () => {
            await isTokenValid();
            const newName = inputName.value;
            const user = auth.currentUser;

            if (!user) {
                status.textContent = '尚未登入，無法更新名稱';
                return;
            }

            if (!newName) {
                status.textContent = '請輸入新名稱';
                return;
            }

            if (!confirm('確定要更新名稱嗎?')) {
                status.textContent = '操作已取消';
                return;
            }

            try {
                const updates = {
                    [`/technotes/user/${user.uid}/name`]: newName,
                    [`/technotes/check/${newName}`]: user.uid
                };

                const oldName = (await get(ref(database, `technotes/user/${user.uid}/name`))).val();
                if (oldName && oldName !== newName) {
                    updates[`/technotes/check/${oldName}`] = null;
                }

                update(ref(database), updates)
                    .then(async () => {
                        status.textContent = '名稱更新成功';
                        inputName.placeholder = `輸入新名稱(${(await get(ref(database, `technotes/user/${auth.currentUser.uid}/name`))).val()})`;
                        inputName.value = '';
                        await timer.delay(3000);
                        status.textContent = '';
                    })
                    .catch((error) => {
                        status.textContent = "更新失敗：" + error;
                    });
            } catch (error) {
                status.textContent = '更新失敗：' + error.message;
            }
        });
    }
    //#endregion






    //#region API圖片上傳功能
    async function uploadImages(file) {
        if (!file) return alert('請選擇照片');

        const reader = new FileReader();
        reader.onload = async function () {
            const base64Content = reader.result.split(',')[1];

            const repo = 'duckodes/TechNotesPicture';
            const path = `${auth.currentUser.uid}/${file.name}`;
            const tokenSnapshot = await get(ref(database, `github/${auth.currentUser.uid}/token`));
            const token = tokenSnapshot.val();

            const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `新增圖片 ${file.name}`,
                    content: base64Content
                })
            });

            if (response.ok) {
                alert('照片已成功上傳到 GitHub！');
            } else {
                const error = await response.json();
                alert('上傳失敗：' + error.message);
            }
        };
        reader.readAsDataURL(file);
    }
    async function getImageFiles() {
        const repo = 'duckodes/TechNotesPicture';

        const apiUrl = `https://api.github.com/repos/${repo}/git/trees/main?recursive=1`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (!data.tree) {
                throw new Error("無法取得檔案樹");
            }
            const files = data.tree.filter(item =>
                item.type === "blob" && item.path.startsWith(auth.currentUser.uid + "/")
            );

            return files.map(file => file.path.split("/").pop());
        } catch (error) {
            console.error("取得檔案失敗：", error);
            return [];
        }
    }
    async function deleteFileFromGitHub(fileName) {
        if (fileName === '') return;

        const repo = 'duckodes/TechNotesPicture';
        const path = `${auth.currentUser.uid}/${fileName}`;
        const tokenSnapshot = await get(ref(database, `github/${auth.currentUser.uid}/token`));
        const token = tokenSnapshot.val();
        const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

        try {
            // 取得檔案的 SHA 值
            const getResponse = await fetch(apiUrl);

            if (!getResponse.ok) {
                const error = await getResponse.json();
                throw new Error(`無法取得檔案資訊: ${error.message}`);
            }

            const fileData = await getResponse.json();
            const fileSha = fileData.sha;

            // 發送 DELETE 請求
            const deleteResponse = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `刪除檔案 ${path}`,
                    sha: fileSha
                })
            });

            if (deleteResponse.ok) {
                console.log('檔案已成功刪除');
            } else {
                const error = await deleteResponse.json();
                console.error('刪除失敗：', error.message);
            }
        } catch (error) {
            console.error('操作失敗：', error.message);
        }
    }
    //#endregion






    //#region API更新Sitemap
    async function pushSitemapToGitHub(fileToInsert, path = 'sitemap.xml') {
        const apiUrl = `https://api.github.com/repos/duckodes/TechNotesSitemap/contents/${path}`;

        const tokenSnapshot = await get(ref(database, `github/${auth.currentUser.uid}/token`));
        const token = tokenSnapshot.val();

        let sha = null;
        let existingContent = '';

        try {
            const res = await fetch(apiUrl, {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            });

            if (res.ok) {
                const data = await res.json();
                sha = data.sha;
                function decodeBase64Utf8(base64) {
                    const binary = atob(base64);
                    const bytes = new Uint8Array([...binary].map(c => c.charCodeAt(0)));
                    return new TextDecoder().decode(bytes);
                }
                existingContent = decodeBase64Utf8(data.content);
            }
        } catch (err) {
            console.warn('sitemap.xml 不存在，將建立新檔案');
        }

        // 建立或更新 sitemap.xml 內容
        function extractLocFromXml(xml) {
            const locMatch = xml.match(/<loc>(.*?)<\/loc>/);
            return locMatch ? locMatch[1] : null;
        }

        function insertUserUrl(existingContent, fileToInsert) {
            const newLoc = extractLocFromXml(fileToInsert);

            // 如果 sitemap 不存在，或不是有效的 <urlset> 結構 → 建立新的
            if (!existingContent || !existingContent.includes('<urlset')) {
                console.log('sitemap 不存在，建立新的');
                const newContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${fileToInsert}\n</urlset>`;
                return { updatedContent: newContent, didUpdate: true };
            }

            // 如果已經有該 user 的 <loc> → 不插入
            if (newLoc && existingContent.includes(newLoc)) {
                console.log(`已存在，不需要更新：${newLoc}`);
                return { updatedContent: null, didUpdate: false };
            }

            // 插入新的 <url> 區塊
            const newContent = existingContent.replace('</urlset>', `${fileToInsert}\n</urlset>`);
            console.log(`插入新的 user URL：${newLoc}`);
            return { updatedContent: newContent, didUpdate: true };
        }

        const { updatedContent, didUpdate } = insertUserUrl(existingContent, fileToInsert);

        if (!didUpdate || !updatedContent) {
            console.log('sitemap.xml 沒有變動，不需要 push');
            return;
        }

        // 編碼為 base64（使用 TextEncoder）
        function encodeBase64Utf8(str) {
            const utf8Bytes = new TextEncoder().encode(str);
            const base64String = btoa(String.fromCharCode(...utf8Bytes));
            return base64String;
        }
        const encodedContent = encodeBase64Utf8(updatedContent);

        // 建立 payload 並 push 到 GitHub
        const payload = {
            message: 'update sitemap.xml',
            content: encodedContent,
            branch: 'main',
            ...(sha && { sha })
        };

        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok) {
            console.log('sitemap.xml updated:', result.content.html_url);
        } else {
            console.error('Failed to update sitemap.xml:', result);
        }
    }
    async function deleteUserFromSitemap(locToDelete, path = 'sitemap.xml') {
        const apiUrl = `https://api.github.com/repos/duckodes/TechNotesSitemap/contents/${path}`;

        const tokenSnapshot = await get(ref(database, `github/${auth.currentUser.uid}/token`));
        const token = tokenSnapshot.val();

        let sha = null;
        let existingContent = '';

        try {
            const res = await fetch(apiUrl, {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            });

            if (res.ok) {
                const data = await res.json();
                sha = data.sha;
                function decodeBase64Utf8(base64) {
                    const binary = atob(base64);
                    const bytes = new Uint8Array([...binary].map(c => c.charCodeAt(0)));
                    return new TextDecoder().decode(bytes);
                }
                existingContent = decodeBase64Utf8(data.content);
            } else {
                console.warn('sitemap.xml 不存在，無法刪除');
                return;
            }
        } catch (err) {
            console.error('無法讀取 sitemap.xml:', err);
            return;
        }

        // 用正則找出包含該 <loc> 的整個 <url> 區塊
        const urlRegex = new RegExp(`<url>\\s*<loc>${locToDelete.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>[\\s\\S]*?<\\/url>`, 'g');
        const updatedContent = existingContent
            .replace(urlRegex, '')
            .replace(/^\s*[\r\n]/gm, '') // 移除空行
            .trim();

        if (updatedContent === existingContent) {
            console.log(`sitemap.xml 中沒有找到 <loc>${locToDelete}</loc>，無需更新`);
            return;
        }

        // 編碼為 base64
        function encodeBase64Utf8(str) {
            const utf8Bytes = new TextEncoder().encode(str);
            const base64String = btoa(String.fromCharCode(...utf8Bytes));
            return base64String;
        }
        const encodedContent = encodeBase64Utf8(updatedContent);

        const payload = {
            message: `delete <url> for ${locToDelete}`,
            content: encodedContent,
            branch: 'main',
            sha
        };

        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok) {
            console.log(`已從 sitemap.xml 中刪除：${locToDelete}`);
        } else {
            console.error('刪除失敗:', result);
        }
    }
    //#endregion
})();