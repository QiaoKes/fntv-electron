package api

import (
	"context"
	"errors"
	"proxy/pkg/fnapi"
	"proxy/pkg/logger"
	"proxy/pkg/utils"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

var (
	// 115盘请求速率限制器，1s/次
	globalLimiter = rate.NewLimiter(rate.Limit(1), 1)
	globalCtx     = context.Background()
)

func waitLimiter() error {
	return globalLimiter.Wait(globalCtx)
}

// parseQueryParam 解析查询参数
func parseQueryParam(c *gin.Context) (*PlayVideoParams, error) {
	var params PlayVideoParams

	// 先绑定 URL Path 里的参数
	if err := c.ShouldBindUri(&params); err != nil {
		return nil, err
	}

	// 再绑定 query 参数
	if err := c.ShouldBindQuery(&params); err != nil {
		return nil, err
	}

	if params.Domain == "" || params.Token == "" || params.ItemGuid == "" || params.Account == "" {
		return nil, errors.New("missing required parameters")
	}

	return &params, nil
}

// ParseCloudInfo 解析云存储信息
func ParseCloudInfo(info fnapi.StreamResponse) *CloudStorageInfo {
	if info.CloudStorageInfo == nil {
		return nil
	}

	// 没有直链
	if len(info.DirectLinkQualities) <= 0 {
		return nil
	}

	result := &CloudStorageInfo{}
	result.DownloadURL = info.DirectLinkQualities[0].URL

	if len(info.Header.Cookie) > 0 {
		result.Cookie = strings.Join(info.Header.Cookie, "; ")
	}

	result.CloudType = CloudType(info.CloudStorageInfo.CloudStorageType)

	return result
}

func PlayVideoHandler(c *gin.Context) {
	// 解析参数
	params, err := parseQueryParam(c)
	if err != nil {
		logger.Errorf("解析参数失败: %v", err)
		c.JSON(400, gin.H{"error": "Invalid parameters"})
		return
	}

	// 忽略证书错误
	skipVerify := params.SkipVerify == 1
	// 使用本地NAS代理
	useNasLocal := params.UseNasLocal == 1

	fnApi := fnapi.NewApiService(params.Domain, params.Token, skipVerify)

	// 获取播放信息（带缓存）
	logger.Infof("开始获取播放信息: itemGuid=%s", params.ItemGuid)
	resp, err := fnApi.GetStreamListCached(params.ItemGuid)
	if err != nil || !resp.Success {
		logger.Errorf("获取播放信息失败: %v", err)
		c.JSON(500, gin.H{"error": "Failed to get play info"})
		return
	}

	playInfo := resp.Data.VideoStreams
	if len(playInfo) <= 0 {
		logger.Errorf("播放信息为空: itemGuid=%s", params.ItemGuid)
		c.JSON(500, gin.H{"error": "No play info found"})
		return
	}

	mediaGuid := playInfo[0].MediaGUID
	if params.SourceIndex > 0 && int(params.SourceIndex) < len(playInfo) {
		mediaGuid = playInfo[params.SourceIndex].MediaGUID
	}

	// 获取流信息
	logger.Infof("开始获取流信息: mediaGuid=%s, account=%s", mediaGuid, params.Account)
	streamResp, err := fnApi.GetStreamCached(mediaGuid, params.Account)
	if err != nil || !streamResp.Success {
		logger.Errorf("获取视频流失败: %v", err)
		c.JSON(500, gin.H{"error": "Failed to get stream"})
		return
	}

	// 代理URL
	target := fnApi.GetVideoURL(mediaGuid)
	// 代理模式, 默认透明代理
	proxyType := TransparentProxy
	// 额外头部
	extraHeaders := utils.PassthroughHeaders(c.Request)

	cloudInfo := ParseCloudInfo(streamResp.Data)
	// 有云盘信息，并且没有启用NAS本地代理模式
	if cloudInfo != nil && !useNasLocal {
		target = cloudInfo.DownloadURL
		extraHeaders["Cookie"] = cloudInfo.Cookie
		logger.Infof("检测到云存储信息: type=%d, url=%s", cloudInfo.CloudType, cloudInfo.DownloadURL)
		switch cloudInfo.CloudType {
		case QuarkPan:
			proxyType = ChunkedProxy
		case Cloud115Pan, AliPan, BaiduPan, Cloud123Pan:
			proxyType = TransparentProxy
		default:
			proxyType = TransparentProxy
		}
		// 云盘直链模式不允许忽略证书错误
		skipVerify = false
	}

	// 通用头部
	extraHeaders["Authorization"] = params.Token
	// User-Agent
	extraHeaders["User-Agent"] = "trim_player"

	if cloudInfo != nil && cloudInfo.CloudType == Cloud115Pan {
		switch cloudInfo.CloudType {
		case Cloud115Pan:
			// 等待速率限制, 防止风控
			_ = waitLimiter()
		case BaiduPan:
			extraHeaders["User-Agent"] = "pan.baidu.com"
		}
	}

	// 开始代理
	switch proxyType {
	case TransparentProxy:
		logger.Infof("开始透明代理到: %s", target)
		utils.DynamicProxy(c, target, extraHeaders, skipVerify)
	case ChunkedProxy:
		logger.Infof("开始切片对齐代理到: %s", target)
		// 使用云盘处理器处理边下边播请求
		handler := utils.NewCloudStorageHandler(target, extraHeaders, skipVerify)
		handler.HandleRequest(c)
	default:
		logger.Infof("unknown proxy type, default to transparent: %s", target)
		utils.DynamicProxy(c, target, extraHeaders, skipVerify)
	}
}
