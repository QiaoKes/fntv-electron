// preload/core/utils.js
function getCookie(name) {
    const cookies = document.cookie.split(';');
    const nameEQ = name + '=';

    for (const cookie of cookies) {
        const trimmed = cookie.trim();
        if (trimmed.startsWith(nameEQ)) {
            return trimmed.substring(nameEQ.length);
        }
    }
    return null;
}

module.exports = {
    getCookie,
};
