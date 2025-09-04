/**
 * 用户首选项管理
 * 用于保存和读取用户的偏好设置
 */

interface UserPreferences {
    macCloseAction?: 'minimize' | 'quit' | 'ask';
    trayNotificationShown?: boolean;
}

let preferences: UserPreferences = {
    macCloseAction: 'ask', // 默认询问用户
    trayNotificationShown: false
};

/**
 * 获取 macOS 关闭行为偏好
 */
export function getMacCloseAction(): 'minimize' | 'quit' | 'ask' {
    return preferences.macCloseAction || 'ask';
}

/**
 * 设置 macOS 关闭行为偏好
 */
export function setMacCloseAction(action: 'minimize' | 'quit' | 'ask'): void {
    preferences.macCloseAction = action;
}

/**
 * 重置为默认偏好
 */
export function resetPreferences(): void {
    preferences = {
        macCloseAction: 'ask',
        trayNotificationShown: false
    };
}

export default {
    getMacCloseAction,
    setMacCloseAction,
    resetPreferences
};
