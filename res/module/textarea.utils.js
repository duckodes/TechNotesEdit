const textareaUtils = (() => {
    function autoResizeTextarea(mainElement, textarea) {
        const adjustHeight = () => {
            const prevScrollTop = mainElement.scrollTop;
            textarea.style.height = "auto";
            textarea.style.height = textarea.scrollHeight + "px";
            mainElement.scrollTop = prevScrollTop;
        };

        adjustHeight();

        textarea.addEventListener("input", adjustHeight);

        const resizeObserver = new ResizeObserver(adjustHeight);
        resizeObserver.observe(textarea);
    }
    return {
        autoResizeTextarea: autoResizeTextarea
    }
})();

export default textareaUtils;