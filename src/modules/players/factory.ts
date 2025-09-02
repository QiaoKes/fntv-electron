import { BasePlayer, PlayerConfig, PlayerConstructor, PlayerRegistry, PlayerType } from './types';

// 播放器工厂类
export class PlayerFactory {
    private static registry: PlayerRegistry = {};

    /**
     * 注册播放器
     * @param type 播放器类型
     * @param playerClass 播放器类构造函数
     */
    static registerPlayer(type: string, playerClass: PlayerConstructor): void {
        this.registry[type] = playerClass;
    }

    /**
     * 创建播放器实例
     * @param type 播放器类型
     * @param config 播放器配置
     * @returns 播放器实例
     */
    static createPlayer(type: string, config: PlayerConfig): BasePlayer {
        const PlayerClass = this.registry[type];
        if (!PlayerClass) {
            throw new Error(`Unsupported player type: ${type}`);
        }
        return new PlayerClass(config);
    }

    /**
     * 获取已注册的播放器类型列表
     * @returns 播放器类型数组
     */
    static getRegisteredTypes(): string[] {
        return Object.keys(this.registry);
    }

    /**
     * 检查播放器类型是否已注册
     * @param type 播放器类型
     * @returns 是否已注册
     */
    static isTypeRegistered(type: string): boolean {
        return type in this.registry;
    }
}
