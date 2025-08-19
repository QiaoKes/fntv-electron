const hooks = {
    onReady: [],
    onDomChange: [],
};

function registerHook(type, fn) {
    if (!hooks[type]) throw new Error(`Unknown hook type: ${type}`);
    hooks[type].push(fn);
}

function runHooks(type, ...args) {
    if (!hooks[type]) return;
    hooks[type].forEach(fn => fn(...args));
}

module.exports = {
    registerHook,
    runHooks
};
