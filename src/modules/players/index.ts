// 导出类型定义
export * from './types';

// 导出工厂类
export { PlayerFactory } from './factory';

// 导出播放器实现
export { MpvPlayer } from './impl/mpv';

// 默认导出工厂实例，便于直接使用
import { PlayerFactory } from './factory';
export default PlayerFactory;
