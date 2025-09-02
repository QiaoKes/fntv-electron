import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';

type IpcHandler = (event: IpcMainEvent, ...args: any[]) => void;
type IpcInvokeHandler = (event: IpcMainInvokeEvent, ...args: any[]) => any;

interface HandlerOptions {
    useHandle?: boolean;
}

interface HandlerInfo {
    handler: IpcHandler | IpcInvokeHandler;
    options: HandlerOptions;
}

const handlers = new Map<string, HandlerInfo>();

/**
 * 注册 IPC 处理器
 * @param channel - IPC 通道名称
 * @param handler - 处理函数
 * @param options - 选项配置
 */
function registerHandler(channel: string, handler: IpcHandler | IpcInvokeHandler, options: HandlerOptions = {}): void {
    if (handlers.has(channel)) {
        throw new Error(`Handler for channel "${channel}" already registered`);
    }
    
    handlers.set(channel, { handler, options });
    
    // 根据选项决定使用 handle 还是 on
    if (options.useHandle) {
        ipcMain.handle(channel, handler as IpcInvokeHandler);
    } else {
        ipcMain.on(channel, handler as IpcHandler);
    }
}

/**
 * 移除 IPC 处理器
 * @param channel - IPC 通道名称
 */
function removeHandler(channel: string): void {
    if (handlers.has(channel)) {
        ipcMain.removeAllListeners(channel);
        handlers.delete(channel);
    }
}

/**
 * 获取所有已注册的处理器
 */
function getRegisteredHandlers(): string[] {
    return Array.from(handlers.keys());
}

/**
 * 清除所有处理器
 */
function clearAllHandlers(): void {
    handlers.forEach((_, channel) => {
        ipcMain.removeAllListeners(channel);
    });
    handlers.clear();
}

export {
    registerHandler,
    removeHandler,
    getRegisteredHandlers,
    clearAllHandlers
};
