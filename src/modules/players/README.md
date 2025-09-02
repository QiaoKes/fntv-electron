# 媒体播放器模块

这个模块提供了一个可扩展的媒体播放器架构，支持多种播放器类型。

## 特性

- 🎯 **抽象设计**: 统一的播放器接口，易于扩展
- 🏭 **工厂模式**: 通过工厂方法创建不同类型的播放器
- 📝 **TypeScript**: 完整的类型定义和类型安全
- 🔄 **自动注册**: 播放器类型自动注册到工厂
- 🎮 **统一接口**: 所有播放器都提供相同的公共方法

## 支持的播放器

- **MPV**: 高性能媒体播放器
- **VLC**: 通用媒体播放器
- 可扩展其他播放器...

## 基本用法

```typescript
import { PlayerFactory, PlayerType, PlayerConfig } from './modules/players';

// 创建播放器配置
const config: PlayerConfig = {
    url: 'https://example.com/video.mp4',
    title: '我的视频',
    headers: {
        'User-Agent': 'MyApp/1.0'
    },
    debug: true,
    onData: (status) => {
        console.log('播放进度:', status);
    },
    onError: (error) => {
        console.error('播放错误:', error);
    },
    onExit: (code, status) => {
        console.log('播放结束:', code, status);
    }
};

// 创建 MPV 播放器
const player = PlayerFactory.createPlayer(PlayerType.MPV, config);

// 开始播放
player.play();

// 检查状态
console.log('播放状态:', player.getStatus());
console.log('是否正在播放:', player.isPlaying());

// 停止播放
player.stop();
```

## 公共方法

所有播放器都实现以下公共方法：

### `play(): ChildProcess | null`
开始播放媒体

### `stop(): void`
停止播放

### `getStatus(): PlaybackStatus`
获取当前播放状态
```typescript
interface PlaybackStatus {
    currentSeconds: number;  // 当前播放时间（秒）
    totalSeconds: number;    // 总时长（秒）
    percentage: number;      // 播放进度百分比
}
```

### `isPlaying(): boolean`
检查是否正在播放

## 配置选项

```typescript
interface PlayerConfig {
    url: string;                                    // 媒体URL（必需）
    title?: string;                                 // 媒体标题
    headers?: Record<string, string>;               // HTTP请求头
    debug?: boolean;                                // 调试模式
    extraArgs?: string[];                           // 额外的命令行参数
    onData?: (data: PlaybackStatus) => void;        // 进度数据回调
    onError?: (error: string) => void;              // 错误回调
    onExit?: (code: number | null, status: PlaybackStatus) => void;  // 退出回调
}
```

## 扩展新的播放器

要添加新的播放器类型，只需：

1. 创建新的播放器类继承 `BasePlayer`
2. 实现 `play()` 方法
3. 在类文件末尾注册到工厂

```typescript
import { BasePlayer, PlayerConfig } from '../types';
import { PlayerFactory } from '../factory';

export class MyCustomPlayer extends BasePlayer {
    play(): ChildProcess | null {
        // 实现播放逻辑
        return null;
    }
}

// 注册到工厂
PlayerFactory.registerPlayer('mycustom', MyCustomPlayer);
```

## 工厂方法

### `PlayerFactory.createPlayer(type: string, config: PlayerConfig): BasePlayer`
创建指定类型的播放器实例

### `PlayerFactory.getRegisteredTypes(): string[]`
获取已注册的播放器类型列表

### `PlayerFactory.isTypeRegistered(type: string): boolean`
检查播放器类型是否已注册

## 文件结构

```
src/modules/players/
├── types.ts           # 类型定义
├── factory.ts         # 播放器工厂
├── index.ts           # 主导出文件
├── example.ts         # 使用示例
├── players/
│   ├── mpv.ts         # MPV播放器实现
│   └── vlc.ts         # VLC播放器实现
└── README.md          # 说明文档
```

## 注意事项

- 确保系统已安装相应的播放器程序（如 mpv、vlc）
- 播放器路径可以通过配置参数自定义
- 进度数据采用节流机制，默认15秒间隔更新
- 所有播放器都支持调试模式，可输出详细日志
