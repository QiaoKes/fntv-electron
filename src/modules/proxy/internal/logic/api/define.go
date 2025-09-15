package api

type CloudType int32 // CloudType 云盘类型
type ProxyType int32 // ProxyType 代理类型

const (
	BaiduPan    CloudType = 1 // BaiduPan 百度网盘
	AliPan      CloudType = 2 // AliPan 阿里云盘
	Cloud115Pan CloudType = 3 // Cloud115Pan 115网盘
	QuarkPan    CloudType = 4 // QuarkPan 夸克云盘
	Cloud123Pan CloudType = 5 // Cloud123Pan 123云盘
)

const (
	TransparentProxy ProxyType = iota // TransparentProxy 透明转发
	ChunkedProxy                      // ChunkedProxy 切片对齐转发
)

// PlayVideoParams 播放视频请求参数
type PlayVideoParams struct {
	ItemGuid    string `json:"itemGuid" uri:"itemGuid"`
	Token       string `json:"token" form:"token"`
	Account     string `json:"account" form:"account"`
	Domain      string `json:"domain" form:"domain"`
	SkipVerify  int32  `json:"skipVerify" form:"skipVerify"`
	UseNasLocal int32  `json:"useNasLocal" form:"useNasLocal"`
}

// CloudStorageInfo 云存储信息
type CloudStorageInfo struct {
	CloudType   CloudType `json:"cloudType"`
	DownloadURL string    `json:"downloadUrl"`
	Cookie      string    `json:"cookie"`
}
