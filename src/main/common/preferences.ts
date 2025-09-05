/**
 * 用户首选项管理
 * 用于保存和读取用户的偏好设置
 */

import { 
    getMacCloseAction as getConfigMacCloseAction, 
    setMacCloseAction as setConfigMacCloseAction,
    getTrayNotificationShown as getConfigTrayNotificationShown,
    setTrayNotificationShown as setConfigTrayNotificationShown
} from '../../modules/fn_config/config';

interface UserPreferences {
    macCloseAction?: 'minimize' | 'quit' | 'ask';
    trayNotificationShown?: boolean;
}

/**
 * 获取 macOS 关闭行为偏好
 */
export function getMacCloseAction(): 'minimize' | 'quit' | 'ask' {
    return getConfigMacCloseAction();
}

/**
 * 设置 macOS 关闭行为偏好
 */
export function setMacCloseAction(action: 'minimize' | 'quit' | 'ask'): void {
    setConfigMacCloseAction(action);
}

/**
 * 获取托盘通知是否已显示过
 */
export function getTrayNotificationShown(): boolean {
    return getConfigTrayNotificationShown();
}

/**
 * 设置托盘通知已显示状态
 */
export function setTrayNotificationShown(shown: boolean): void {
    setConfigTrayNotificationShown(shown);
}

/**
 * 重置为默认偏好
 */
export function resetPreferences(): void {
    setMacCloseAction('ask');
    setTrayNotificationShown(false);
}

export default {
    getMacCloseAction,
    setMacCloseAction,
    getTrayNotificationShown,
    setTrayNotificationShown,
    resetPreferences
};
