// preload/core/utils.ts
import type { Utils } from './types';

function getCookie(name: string): string | null {
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

const utils: Utils = {
    getCookie,
};

export { getCookie };
export default utils;
