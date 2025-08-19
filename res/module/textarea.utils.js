const textareaUtils = (() => {
    function autoResizeTextarea(textarea) {
        const adjustHeight = () => {
            textarea.style.height = "auto";
            textarea.style.height = textarea.scrollHeight + "px";
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