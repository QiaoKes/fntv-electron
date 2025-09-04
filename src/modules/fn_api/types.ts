/**
 * 飞牛影视API相关的类型定义
 * 包含登录、播放、字幕等功能所需的数据结构
 */

/**
 * 登录请求数据
 */
export interface LoginData {
    /** 应用名称 */
    app_name: string;
    /** 用户名 */
    username: string;
    /** 密码 */
    password: string;
}

/**
 * 播放信息请求数据
 */
export interface PlayInfoData {
    /** 视频项目的唯一标识符 */
    item_guid: string;
}

/**
 * 字幕流信息
 */
export interface SubtitleStream {
    /** 字幕流的唯一标识符 */
    guid: string;
    /** 字幕格式，如srt、ass等 */
    format: string;
    /** 字幕标题/名称 */
    title: string;
}

/**
 * 字幕列表响应数据
 */
export interface SubtitleResponse {
    /** 字幕流数组，可选 */
    subtitle_streams?: SubtitleStream[];
}

/**
 * 字幕对象
 */
export interface Subtitle {
    /** 字幕ID */
    id: string;
    /** 字幕格式 */
    format: string;
    /** 字幕名称 */
    name: string;
}

/**
 * 字幕下载结果
 */
export interface SubtitleDownloadResult {
    /** 字幕ID */
    id: string;
    /** 下载的文件路径 */
    filePath: string;
    /** 下载是否成功 */
    success: boolean;
    /** 错误信息（如果失败） */
    error?: string;
}

/**
 * 用户信息
 */
export interface UserInfo {
    /** 根据实际API响应定义用户信息结构 */
    [key: string]: any;
}

/**
 * 播放信息接口
 * 包含视频播放所需的完整信息，包括媒体流、播放配置和详细的项目信息
 */
export interface PlayInfo {
    /** 祖父级GUID，用于层级关系定位 */
    grand_guid: string;
    /** 当前项目的唯一标识符 */
    guid: string;
    /** 父级项目GUID，用于关联上级内容 */
    parent_guid: string;
    /** 播放配置信息 */
    play_config: {
        /** 跳过片头的时间点（秒），null表示不跳过 */
        skip_opening: number | null;
        /** 跳过片尾的时间点（秒），null表示不跳过 */
        skip_ending: number | null;
    };
    /** 播放进度时间戳（秒） */
    ts: number;
    /** 内容类型，如"Episode"表示剧集 */
    type: string;
    /** 视频流的唯一标识符 */
    video_guid: string;
    /** 音频流的唯一标识符 */
    audio_guid: string;
    /** 字幕流的唯一标识符，"no_display"表示不显示字幕 */
    subtitle_guid: string;
    /** 媒体文件的唯一标识符，用于获取播放链接 */
    media_guid: string;
    /** 详细的项目信息 */
    item: {
        /** 项目唯一标识符 */
        guid: string;
        /** Trim ID，外部数据库标识 */
        trim_id: string;
        /** 电视剧/系列名称 */
        tv_title: string;
        /** 父级标题，如"第 1 季" */
        parent_title: string;
        /** 当前集的标题 */
        title: string;
        /** 海报图片路径 */
        posters: string;
        /** 海报宽度（像素） */
        poster_width: number;
        /** 海报高度（像素） */
        poster_height: number;
        /** 评分，字符串格式 */
        vote_average: string;
        /** 运行时长（分钟） */
        runtime: number;
        /** 内容简介 */
        overview: string;
        /** 是否收藏，1表示已收藏，0表示未收藏 */
        is_favorite: number;
        /** 是否已观看，1表示已观看，0表示未观看 */
        is_watched: number;
        /** 观看进度时间戳（秒） */
        watched_ts: number;
        /** 剧照图片路径 */
        still_path: string;
        /** 播出日期，格式为YYYY-MM-DD */
        air_date: string;
        /** 季数 */
        season_number: number;
        /** 集数 */
        episode_number: number;
        /** 总季数 */
        number_of_seasons: number;
        /** 总集数 */
        number_of_episodes: number;
        /** 本地总集数 */
        local_number_of_episodes: number;
        /** 本地总季数 */
        local_number_of_seasons: number;
        /** 是否可播放，1表示可播放，0表示不可播放 */
        can_play: number;
        /** 内容类型，如"Episode" */
        type: string;
        /** 播放错误信息，空字符串表示无错误 */
        play_error: string;
        /** 父级项目GUID */
        parent_guid: string;
        /** 祖先分类名称，如"日漫" */
        ancestor_name: string;
        /** 播放项目GUID */
        play_item_guid: string;
        /** 视频时长（秒） */
        duration: number;
        /** 逻辑类型标识 */
        logic_type: number;
    };
}

/**
 * 已观看状态数据
 */
export interface WatchedData {
    /** 视频项目的唯一标识符 */
    item_guid: string;
}

/**
 * 播放状态记录数据
 */
export interface PlayStatusData {
    /** 视频项目的唯一标识符 */
    item_guid: string;
    /** 媒体文件的唯一标识符 */
    media_guid: string;
    /** 视频流的唯一标识符 */
    video_guid: string;
    /** 音频流的唯一标识符 */
    audio_guid: string;
    /** 字幕流的唯一标识符 */
    subtitle_guid: string;
    /** 播放链接 */
    play_link: string;
    /** 播放进度时间戳（秒） */
    ts: number;
    /** 视频总时长（秒） */
    duration: number;
}

/**
 * 媒体流信息
 */
export interface MediaStream {
    /** 可用分辨率列表 */
    resolutions: string[] | null;
    /** 音频类型 */
    audio_type: string | null;
    /** 颜色范围类型 */
    color_range_type: string | null;
}

/**
 * 播放列表项目
 */
export interface PlayListItem {
    /** 项目唯一标识符 */
    guid: string;
    /** 语言标识 */
    lan: string;
    /** 豆瓣ID */
    douban_id: number;
    /** IMDB ID */
    imdb_id: string;
    /** Trim ID，外部数据库标识 */
    trim_id: string;
    /** 电视剧/系列名称 */
    tv_title: string;
    /** 父级项目GUID */
    parent_guid: string;
    /** 父级标题 */
    parent_title: string;
    /** 当前集的标题 */
    title: string;
    /** 内容类型，如"Episode" */
    type: string;
    /** 海报图片路径 */
    poster: string;
    /** 海报宽度（像素） */
    poster_width: number;
    /** 海报高度（像素） */
    poster_height: number;
    /** 运行时长（分钟） */
    runtime: number;
    /** 是否收藏，1表示已收藏，0表示未收藏 */
    is_favorite: number;
    /** 是否已观看，1表示已观看，0表示未观看 */
    watched: number;
    /** 观看进度时间戳（秒） */
    watched_ts: number;
    /** 评分，字符串格式 */
    vote_average: string;
    /** 媒体流信息 */
    media_stream: MediaStream;
    /** 季数 */
    season_number: number;
    /** 集数 */
    episode_number: number;
    /** 播出日期，格式为YYYY-MM-DD */
    air_date: string;
    /** 总季数 */
    number_of_seasons: number;
    /** 总集数 */
    number_of_episodes: number;
    /** 本地总季数 */
    local_number_of_seasons: number;
    /** 本地总集数 */
    local_number_of_episodes: number;
    /** 状态信息 */
    status: string;
    /** 内容简介 */
    overview: string;
    /** 祖先GUID */
    ancestor_guid: string;
    /** 祖先名称 */
    ancestor_name: string;
    /** 祖先分类 */
    ancestor_category: string;
    /** 播放进度时间戳（秒） */
    ts: number;
    /** 视频时长（秒） */
    duration: number;
    /** 单个子项GUID */
    single_child_guid: string;
    /** 视频流的唯一标识符 */
    video_guid: string;
    /** 文件名 */
    file_name: string;
}
