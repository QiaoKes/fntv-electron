// preload/types.ts - 类型定义文件
export interface Logger {
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    log: (...args: any[]) => void;
    d: (...args: any[]) => void;
    i: (...args: any[]) => void;
    w: (...args: any[]) => void;
    e: (...args: any[]) => void;
}

export interface PlayMovieData {
    id: string;
    token: string;
}

export interface Utils {
    getCookie: (name: string) => string | null;
}

// 扩展全局 Window 接口
declare global {
    interface Window {
        log: Logger;
        logger: Logger;
    }
    
    // Node.js 全局变量
    namespace NodeJS {
        interface Global {
            log: Logger;
            logger: Logger;
        }
    }
    
    // 全局变量
    var log: Logger;
    var logger: Logger;
}

export {};
