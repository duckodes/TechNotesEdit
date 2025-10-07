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
        }
    });
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
            <div class="date">分類: ${category} 第${index}筆資料</div>
            <br>
            
            <label>標題</label>
            <input type="text" value="${item.title}"><br>

            <label>總結</label>
            <textarea rows="2">${item.summary}</textarea><br>

            <label>內容</label>
            <textarea rows="4">${item.content}</textarea><br>
            
            <button class="code-space">插入代碼框架</button>
            <button class="a-space">插入超連結框架</button>

            <label>圖片連結</label>
            <div class="imageInputs"></div>
            <button class="addImageBtn">新增圖片</button><br>
            <label>上傳圖片</label>
            <input type="file" id="fileInput" accept="image/*" />

            <div class="images"></div>

            <div class="date">日期：${new Date(Number(item.date)).toLocaleString()}</div>

            <select class="recategory" style="margin-right: 10px;"></select>

            <label>內容檢視</label>
            ${!isFromDB ? '' : `<iframe class="preview-page" src="https://notes.duckode.com/?user=${userName}&category=${category}&categoryID=${index}" width="100%" height="600px" style="border:none;"></iframe>`}
            
            <button class="delete">刪除文章</button>
        `;
        window.addEventListener('message', (e) => {
            const params = new URLSearchParams(entry.querySelector('.preview-page')?.src);
            if (e.data.id !== params.get('category') + params.get('categoryID')) return;
            entry.querySelector('.preview-page').height = e.data.height + 'px';
        });
        let resizeTimer;
        let lastWidth = document.documentElement.clientWidth;
        const observer = new ResizeObserver(() => {
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

                            await set(ref(database, `technotes/data/${auth.currentUser.uid}/${recategory}/${nextIndex}`), noteToMove);
                        }
                        if (recategory.value !== category) {
                            await moveNote(category, recategory.value, index);
                        } else {
                            await set(ref(database, `technotes/data/${auth.currentUser.uid}/${category}/${index}`), data[category][index]);
                        }
                        dbEditor.innerHTML = '';
                        manualEditor.innerHTML = '';
                    } catch (error) {
                        alert("上傳失敗:" + error);
                        return;
                    }
                    await updateData();
                    renderDBEditor();
                    renderManualEditor();
                    console.log(`已更新 ${category} ${index}：`, data[category][index]);
                }
            };
            entry.appendChild(uploadSingleBtn);
        }

        container.appendChild(entry);

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
                await updateData();
                renderDBEditor();
                renderManualEditor();
            }
        };

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
                const insertText = '<pre><code>請放入代碼</code></pre>';
                const start = lastFocusedInput.selectionStart;
                const end = lastFocusedInput.selectionEnd;
                const originalText = lastFocusedInput.value;

                lastFocusedInput.value = originalText.slice(0, start) + insertText + originalText.slice(end);
                lastFocusedInput.focus();
                lastFocusedInput.setSelectionRange(start + 11, start + insertText.length - 13);

            }

        };

        const entryASpace = entry.querySelector('.a-space');
        entryASpace.onclick = (e) => {
            e.preventDefault();

            if (lastFocusedInput) {
                const insertText = '<a href="放入超連結" target="_blank">超連結名稱</a>';
                const start = lastFocusedInput.selectionStart;
                const end = lastFocusedInput.selectionEnd;
                const originalText = lastFocusedInput.value;

                lastFocusedInput.value = originalText.slice(0, start) + insertText + originalText.slice(end);
                lastFocusedInput.focus();
                lastFocusedInput.setSelectionRange(start + 9, start + insertText.length - 27);

            }

        };

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

})();