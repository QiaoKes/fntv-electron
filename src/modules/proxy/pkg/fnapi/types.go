package fnapi

// LoginData 登录请求数据
type LoginData struct {
	AppName  string `json:"app_name"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// PlayInfoData 播放信息请求数据
type PlayInfoData struct {
	ItemGUID     string  `json:"item_guid"`
	MediaGUID    *string `json:"media_guid,omitempty"`
	AudioGUID    *string `json:"audio_guid,omitempty"`
	SubtitleGUID *string `json:"subtitle_guid,omitempty"`
	VideoGUID    *string `json:"video_guid,omitempty"`
}

// SubtitleStream 字幕流信息
type SubtitleStream struct {
	GUID   string `json:"guid"`
	Format string `json:"format"`
	Title  string `json:"title"`
}

// SubtitleResponse 字幕列表响应数据
type SubtitleResponse struct {
	SubtitleStreams []SubtitleStream `json:"subtitle_streams,omitempty"`
}

// Subtitle 字幕对象
type Subtitle struct {
	ID     string `json:"id"`
	Format string `json:"format"`
	Name   string `json:"name"`
}

// SubtitleDownloadResult 字幕下载结果
type SubtitleDownloadResult struct {
	ID       string `json:"id"`
	FilePath string `json:"filePath"`
	Success  bool   `json:"success"`
	Error    string `json:"error,omitempty"`
}

// UserInfo 用户信息
type UserInfo map[string]interface{}

// PlayConfig 播放配置信息
type PlayConfig struct {
	SkipOpening *int `json:"skip_opening"`
	SkipEnding  *int `json:"skip_ending"`
}

// Item 项目信息
type Item struct {
	GUID                  string `json:"guid"`
	TrimID                string `json:"trim_id"`
	TVTitle               string `json:"tv_title"`
	ParentTitle           string `json:"parent_title"`
	Title                 string `json:"title"`
	Posters               string `json:"posters"`
	PosterWidth           int    `json:"poster_width"`
	PosterHeight          int    `json:"poster_height"`
	VoteAverage           string `json:"vote_average"`
	Runtime               int    `json:"runtime"`
	Overview              string `json:"overview"`
	IsFavorite            int    `json:"is_favorite"`
	IsWatched             int    `json:"is_watched"`
	WatchedTS             int    `json:"watched_ts"`
	StillPath             string `json:"still_path"`
	AirDate               string `json:"air_date"`
	SeasonNumber          int    `json:"season_number"`
	EpisodeNumber         int    `json:"episode_number"`
	NumberOfSeasons       int    `json:"number_of_seasons"`
	NumberOfEpisodes      int    `json:"number_of_episodes"`
	LocalNumberOfEpisodes int    `json:"local_number_of_episodes"`
	LocalNumberOfSeasons  int    `json:"local_number_of_seasons"`
	CanPlay               int    `json:"can_play"`
	Type                  string `json:"type"`
	PlayError             string `json:"play_error"`
	ParentGUID            string `json:"parent_guid"`
	AncestorName          string `json:"ancestor_name"`
	PlayItemGUID          string `json:"play_item_guid"`
	Duration              int    `json:"duration"`
	LogicType             int    `json:"logic_type"`
}

// PlayInfo 播放信息接口
type PlayInfo struct {
	GrandGUID    string     `json:"grand_guid"`
	GUID         string     `json:"guid"`
	ParentGUID   string     `json:"parent_guid"`
	PlayConfig   PlayConfig `json:"play_config"`
	TS           int        `json:"ts"`
	Type         string     `json:"type"`
	VideoGUID    string     `json:"video_guid"`
	AudioGUID    string     `json:"audio_guid"`
	SubtitleGUID string     `json:"subtitle_guid"`
	MediaGUID    string     `json:"media_guid"`
	Item         Item       `json:"item"`
}

// WatchedData 已观看状态数据
type WatchedData struct {
	ItemGUID string `json:"item_guid"`
}

// PlayStatusData 播放状态记录数据
type PlayStatusData struct {
	ItemGUID     string `json:"item_guid"`
	MediaGUID    string `json:"media_guid"`
	VideoGUID    string `json:"video_guid"`
	AudioGUID    string `json:"audio_guid"`
	SubtitleGUID string `json:"subtitle_guid"`
	PlayLink     string `json:"play_link"`
	TS           int    `json:"ts"`
	Duration     int    `json:"duration"`
}

// MediaStream 媒体流信息
type MediaStream struct {
	Resolutions    []string `json:"resolutions"`
	AudioType      string   `json:"audio_type"`
	ColorRangeType string   `json:"color_range_type"`
}

// PlayQualityItem 播放质量项目
type PlayQualityItem struct {
	Bitrate     int    `json:"bitrate"`
	Resolution  string `json:"resolution"`
	Progressive bool   `json:"progressive"`
}

// PlayQualityResponse 播放质量响应数据
type PlayQualityResponse []PlayQualityItem

// PlayInfoDataExtended 播放信息请求数据（扩展版）
type PlayInfoDataExtended struct {
	AudioGUID    string `json:"audio_guid"`
	ItemGUID     string `json:"item_guid"`
	MediaGUID    string `json:"media_guid"`
	SubtitleGUID string `json:"subtitle_guid"`
	VideoGUID    string `json:"video_guid"`
}

// FileInfo 文件信息
type FileInfo struct {
	GUID                 string `json:"guid"`
	Path                 string `json:"path"`
	FileName             string `json:"file_name"`
	Size                 int64  `json:"size"`
	Timestamp            int64  `json:"timestamp"`
	Type                 int    `json:"type"`
	CanPlay              int    `json:"can_play"`
	PlayError            string `json:"play_error"`
	CreateTime           int64  `json:"create_time"`
	UpdateTime           int64  `json:"update_time"`
	FileBirthTime        int64  `json:"file_birth_time"`
	ProgressThumbHashDir string `json:"progress_thumb_hash_dir"`
}

// VideoStream 视频流信息
type VideoStream struct {
	MediaGUID          string `json:"media_guid"`
	Title              string `json:"title"`
	GUID               string `json:"guid"`
	ResolutionType     string `json:"resolution_type"`
	ColorRangeType     string `json:"color_range_type"`
	CodecName          string `json:"codec_name"`
	CodecType          string `json:"codec_type"`
	ColorRange         string `json:"color_range"`
	Profile            string `json:"profile"`
	Index              int    `json:"index"`
	Width              int    `json:"width"`
	Height             int    `json:"height"`
	CodedWidth         int    `json:"coded_width"`
	CodedHeight        int    `json:"coded_height"`
	DisplayAspectRatio string `json:"display_aspect_ratio"`
	PixFmt             string `json:"pix_fmt"`
	Level              string `json:"level"`
	ColorSpace         string `json:"color_space"`
	ColorTransfer      string `json:"color_transfer"`
	ColorPrimaries     string `json:"color_primaries"`
	Duration           int    `json:"duration"`
	DVProfile          int    `json:"dv_profile"`
	Refs               int    `json:"refs"`
	RFrameRate         string `json:"r_frame_rate"`
	AvgFrameRate       string `json:"avg_frame_rate"`
	BitsPerRawSample   string `json:"bits_per_raw_sample"`
	BPS                int    `json:"bps"`
	Progressive        int    `json:"progressive"`
	BitDepth           int    `json:"bit_depth"`
	Wrapper            string `json:"wrapper"`
	CreateTime         int64  `json:"create_time"`
	UpdateTime         int64  `json:"update_time"`
	Rotation           int    `json:"rotation"`
	Ext1               int    `json:"ext1"`
	IsBluray           bool   `json:"is_bluray"`
}

// AudioStream 音频流信息
type AudioStream struct {
	MediaGUID        string `json:"media_guid"`
	Title            string `json:"title"`
	GUID             string `json:"guid"`
	AudioType        string `json:"audio_type"`
	CodecName        string `json:"codec_name"`
	CodecType        string `json:"codec_type"`
	Language         string `json:"language"`
	Channels         int    `json:"channels"`
	Profile          string `json:"profile"`
	SampleRate       string `json:"sample_rate"`
	IsDefault        int    `json:"is_default"`
	ChannelLayout    string `json:"channel_layout"`
	Duration         int    `json:"duration"`
	Index            int    `json:"index"`
	BitsPerRawSample string `json:"bits_per_raw_sample"`
	BPS              int    `json:"bps"`
	CreateTime       int64  `json:"create_time"`
	UpdateTime       int64  `json:"update_time"`
	IsFake           bool   `json:"is_fake"`
}

// SubtitleStreamExtended 字幕流信息（扩展版）
type SubtitleStreamExtended struct {
	MediaGUID  string `json:"media_guid"`
	Title      string `json:"title"`
	GUID       string `json:"guid"`
	CodecName  string `json:"codec_name"`
	CodecType  string `json:"codec_type"`
	Language   string `json:"language"`
	Forced     int    `json:"forced"`
	Index      int    `json:"index"`
	IsDefault  int    `json:"is_default"`
	IsExternal int    `json:"is_external"`
	Format     string `json:"format"`
	TrimID     string `json:"trim_id"`
	SourceID   string `json:"source_id"`
	Source     string `json:"Source"`
	CreateTime int64  `json:"create_time"`
	UpdateTime int64  `json:"update_time"`
	ExtraFile  int    `json:"extra_file"`
	IsBitmap   int    `json:"is_bitmap"`
	FileSize   int64  `json:"file_size"`
}

// PlayListItem 播放列表项目
type PlayListItem struct {
	GUID                  string      `json:"guid"`
	Lan                   string      `json:"lan"`
	DoubanID              int         `json:"douban_id"`
	IMDBID                string      `json:"imdb_id"`
	TrimID                string      `json:"trim_id"`
	TVTitle               string      `json:"tv_title"`
	ParentGUID            string      `json:"parent_guid"`
	ParentTitle           string      `json:"parent_title"`
	Title                 string      `json:"title"`
	Type                  string      `json:"type"`
	Poster                string      `json:"poster"`
	PosterWidth           int         `json:"poster_width"`
	PosterHeight          int         `json:"poster_height"`
	Runtime               int         `json:"runtime"`
	IsFavorite            int         `json:"is_favorite"`
	Watched               int         `json:"watched"`
	WatchedTS             int         `json:"watched_ts"`
	VoteAverage           string      `json:"vote_average"`
	MediaStream           MediaStream `json:"media_stream"`
	SeasonNumber          int         `json:"season_number"`
	EpisodeNumber         int         `json:"episode_number"`
	AirDate               string      `json:"air_date"`
	NumberOfSeasons       int         `json:"number_of_seasons"`
	NumberOfEpisodes      int         `json:"number_of_episodes"`
	LocalNumberOfSeasons  int         `json:"local_number_of_seasons"`
	LocalNumberOfEpisodes int         `json:"local_number_of_episodes"`
	Status                string      `json:"status"`
	Overview              string      `json:"overview"`
	AncestorGUID          string      `json:"ancestor_guid"`
	AncestorName          string      `json:"ancestor_name"`
	AncestorCategory      string      `json:"ancestor_category"`
	TS                    int         `json:"ts"`
	Duration              int         `json:"duration"`
	SingleChildGUID       string      `json:"single_child_guid"`
	VideoGUID             string      `json:"video_guid"`
	FileName              string      `json:"file_name"`
}

// StreamListResponse 流列表响应数据
type StreamListResponse struct {
	Files           []FileInfo               `json:"files"`
	VideoStreams    []VideoStream            `json:"video_streams"`
	AudioStreams    []AudioStream            `json:"audio_streams"`
	SubtitleStreams []SubtitleStreamExtended `json:"subtitle_streams"`
}

// StreamRequestData 流请求数据
type StreamRequestData struct {
	Header struct {
		UserAgent []string `json:"User-Agent"`
	} `json:"header"`
	Level     int    `json:"level"`
	MediaGUID string `json:"media_guid"`
	IP        string `json:"ip"`
}

// Quality 质量信息
type Quality struct {
	Bitrate     int    `json:"bitrate"`
	Resolution  string `json:"resolution"`
	Progressive bool   `json:"progressive"`
	IsM3U8      bool   `json:"is_m3u8"`
}

// CloudStorageInfo 云存储信息
type CloudStorageInfo struct {
	DavUsername      string `json:"dav_username"`
	Valid            bool   `json:"valid"`
	Disabled         bool   `json:"disabled"`
	CloudStorageType int    `json:"cloud_storage_type"`
	CloudNickName    string `json:"cloud_nick_name"`
	FSSize           int64  `json:"fssize"`
	FRSize           int64  `json:"frsize"`
	FUSize           int64  `json:"fusize"`
	IsVIP            bool   `json:"is_vip"`
	QuarkVIPType     string `json:"quark_vip_type"`
	QuarkPCPayLink   string `json:"quark_pc_pay_link"`
	QuarkWAPPayLink  string `json:"quark_wap_pay_link"`
}

// DirectLinkQuality 直接链接质量
type DirectLinkQuality struct {
	Bitrate     int    `json:"bitrate"`
	Resolution  string `json:"resolution"`
	Progressive bool   `json:"progressive"`
	URL         string `json:"url"`
	IsM3U8      bool   `json:"is_m3u8"`
	ExpiredAt   int64  `json:"expired_at"`
}

// DirectLinkAudioStream 直接链接音频流
type DirectLinkAudioStream struct {
	MediaGUID        string `json:"media_guid"`
	Title            string `json:"title"`
	GUID             string `json:"guid"`
	AudioType        string `json:"audio_type"`
	CodecName        string `json:"codec_name"`
	CodecType        string `json:"codec_type"`
	Language         string `json:"language"`
	Channels         int    `json:"channels"`
	Profile          string `json:"profile"`
	SampleRate       string `json:"sample_rate"`
	IsDefault        int    `json:"is_default"`
	ChannelLayout    string `json:"channel_layout"`
	Duration         int    `json:"duration"`
	Index            int    `json:"index"`
	BitsPerRawSample string `json:"bits_per_raw_sample"`
	BPS              int    `json:"bps"`
	CreateTime       int64  `json:"create_time"`
	UpdateTime       int64  `json:"update_time"`
	IsFake           bool   `json:"is_fake"`
}

// StreamResponse 流响应数据
type StreamResponse struct {
	FileStream       FileInfo                 `json:"file_stream"`
	VideoStream      VideoStream              `json:"video_stream"`
	AudioStreams     []AudioStream            `json:"audio_streams"`
	SubtitleStreams  []SubtitleStreamExtended `json:"subtitle_streams"`
	Qualities        []Quality                `json:"qualities"`
	CloudStorageInfo *CloudStorageInfo        `json:"cloud_storage_info"`
	Header           struct {
		Cookie []string `json:"Cookie"`
	} `json:"header"`
	DirectLinkQualities    []DirectLinkQuality     `json:"direct_link_qualities"`
	DirectLinkAudioStreams []DirectLinkAudioStream `json:"direct_link_audio_streams"`
}
