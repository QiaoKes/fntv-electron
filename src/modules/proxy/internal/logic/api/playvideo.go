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
	params, err := parseQueryParam(c)
	if err != nil {
		logger.Errorf("解析参数失败: %v", err)
		c.JSON(400, gin.H{"error": "Invalid parameters"})
		return
	}

	fnApi := fnapi.NewApiService(params.Domain, params.Token, params.SkipVerify == 1)
	resp, err := fnApi.GetStreamListCached(params.ItemGuid)
	if err != nil || !resp.Success || len(resp.Data.VideoStreams) == 0 {
		logger.Errorf("获取播放信息失败或为空: %v", err)
		c.JSON(500, gin.H{"error": "Failed to get play info"})
		return
	}

	// 选择视频流
	videoStreams := resp.Data.VideoStreams
	targetMediaGuid := videoStreams[0].MediaGUID
	if params.SourceIndex > 0 && int(params.SourceIndex) < len(videoStreams) {
		targetMediaGuid = videoStreams[params.SourceIndex].MediaGUID
	}

	// 获取流地址信息
	streamResp, err := fnApi.GetStreamCached(targetMediaGuid, params.Account)
	if err != nil || !streamResp.Success {
		logger.Errorf("获取视频流失败: %v", err)
		c.JSON(500, gin.H{"error": "Failed to get stream"})
		return
	}

	var (
		targetUrl    = fnApi.GetVideoURL(targetMediaGuid)
		proxyType    = TransparentProxy
		skipVerify   = params.SkipVerify == 1
		extraHeaders = utils.PassthroughHeaders(c.Request)
	)

	cloudInfo := ParseCloudInfo(streamResp.Data)
	useCloudDirect := cloudInfo != nil && params.UseNasLocal != 1

	// 云盘直链模式
	if useCloudDirect {
		logger.Infof("启用云存储直连: type=%d", cloudInfo.CloudType)

		targetUrl = cloudInfo.DownloadURL
		// 禁止跳过证书验证，云厂商的证书通常是合法的，不需要跳过验证
		skipVerify = false

		// 注入云盘需要的 Cookie
		if cloudInfo.Cookie != "" {
			extraHeaders["Cookie"] = cloudInfo.Cookie
		}

		// 选择播放策略
		switch cloudInfo.CloudType {
		case QuarkPan:
			proxyType = ChunkedProxy // 夸克需要切片
		case Cloud115Pan:
			// 115 特殊处理：UA 和限流
			extraHeaders["User-Agent"] = "trim_player"
			_ = waitLimiter()
		case BaiduPan:
			extraHeaders["User-Agent"] = "pan.baidu.com"
			// 其他网盘使用默认的 TransparentProxy
		}
	} else {
		// 本地 NAS 转发模式 ---
		// 只有请求 NAS 时才需要 Authorization Token
		extraHeaders["Authorization"] = params.Token
	}

	// 执行代理
	logger.Infof("开始代理 | 模式: %v | URL: %s", proxyType, targetUrl)

	switch proxyType {
	case ChunkedProxy:
		// 边下边播处理 (如夸克)
		handler := utils.NewCloudStorageHandler(targetUrl, extraHeaders, skipVerify)
		handler.HandleRequest(c)
	default:
		// 透明代理 (本地 NAS 或 115/阿里等直链)
		utils.DynamicProxy(c, targetUrl, extraHeaders, skipVerify)
	}
}
