// preload/core/utils.js
function evaluateXPath(xpath, contextNode = document) {
    const result = [];
    const query = document.evaluate(
        xpath,
        contextNode,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
    );
    for (let i = 0; i < query.snapshotLength; i++) {
        result.push(query.snapshotItem(i));
    }
    return result;
}

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
    evaluateXPath,
    getCookie,
};
