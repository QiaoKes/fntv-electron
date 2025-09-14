package main

import (
	"net/url"
	"strings"

	"proxy/pkg/fnapi"
	"proxy/pkg/logger"
	"proxy/pkg/utils"

	"github.com/gin-gonic/gin"
)

func main() {
	logger.SetLevel(logger.DEBUG)
	logger.SetColor(false)

	r := gin.Default()

	// 播放视频路由
	r.GET("/api/v1/playvideo/:itemGuid", func(c *gin.Context) {
		itemGuid := c.Param("itemGuid")
		logger.Infof("收到播放视频请求: itemGuid=%s", itemGuid)

		if itemGuid == "" {
			logger.Errorf("缺少必需的参数: itemGuid")
			c.JSON(400, gin.H{"error": "Missing item GUID parameter"})
			return
		}

		// 从URL参数获取配置
		token := c.Query("token")
		account := c.Query("account")
		domain := c.Query("domain")
		// domain URL解码
		domain, err := url.QueryUnescape(domain)
		if err != nil {
			logger.Errorf("URL解码失败: %v", err)
			c.JSON(400, gin.H{"error": "Invalid domain parameter"})
			return
		}

		// 解析skipVerify参数
		skipVerify := false
		if v := c.Query("skipVerify"); v == "1" {
			skipVerify = true
			logger.Infof("启用忽略证书验证模式")
		}

		// 解析useNasLocal参数
		useNasLocal := false
		if v := c.Query("useNasLocal"); v == "1" {
			useNasLocal = true
			logger.Infof("启用NAS本地模式")
		}

		logger.Debugf("请求参数: token=%s, account=%s, domain=%s, skipVerify=%t, useNasLocal=%t", token, account, domain, skipVerify, useNasLocal)

		if token == "" || account == "" || domain == "" {
			logger.Errorf("缺少必需的查询参数: token=%s, account=%s, domain=%s", token, account, domain)
			c.JSON(400, gin.H{"error": "Missing required query parameters: token, account, domain"})
			return
		}

		fnapi := fnapi.NewApiService(domain, token, skipVerify)
		logger.Infof("初始化API服务: domain=%s, skipVerify=%t", domain, skipVerify)

		// 获取播放信息（带缓存）
		logger.Infof("开始获取播放信息: itemGuid=%s", itemGuid)
		resp, err := fnapi.GetPlayInfoCached(itemGuid)
		if err != nil {
			logger.Errorf("获取播放信息失败: %v", err)
			c.JSON(500, gin.H{"error": "Failed to get play info"})
			return
		}
		if !resp.Success {
			logger.Errorf("播放信息API响应失败: %s", resp.Message)
			c.JSON(500, gin.H{"error": "Failed to get play info"})
			return
		}
		if resp.Data.MediaGUID == "" {
			logger.Errorf("播放信息中缺少MediaGUID")
			c.JSON(500, gin.H{"error": "Failed to get play info"})
			return
		}

		playInfo := resp.Data
		mediaGuid := playInfo.MediaGUID
		// logger.Infof("成功获取播放信息: %s", utils.JsonPrint(playInfo))

		// 获取流信息
		logger.Infof("开始获取流信息: mediaGuid=%s, account=%s", mediaGuid, account)
		streamResp, err := fnapi.GetStreamCached(mediaGuid, account)
		if err != nil {
			logger.Errorf("获取视频流失败: %v", err)
			c.JSON(500, gin.H{"error": "Failed to get stream"})
			return
		}
		if !streamResp.Success {
			logger.Errorf("流信息API响应失败: %s", streamResp.Message)
			c.JSON(500, gin.H{"error": "Failed to get stream"})
			return
		}

		stream := streamResp.Data
		logger.Infof("成功获取流信息")

		// 目标URL
		target := fnapi.GetVideoURL(mediaGuid)
		extraHeaders := utils.PassthroughHeaders(c.Request)

		useCloud := false

		// 云盘处理, 并且没有启用NAS本地代理模式
		if stream.CloudStorageInfo != nil && !useNasLocal {
			logger.Infof("检测到云存储信息，开始处理云盘直链")
			cookie := stream.Header.Cookie
			qualities := stream.DirectLinkQualities
			if len(cookie) == 0 || len(qualities) == 0 {
				logger.Errorf("云盘直链数据不完整: cookie数量=%d, qualities数量=%d", len(cookie), len(qualities))
				c.JSON(500, gin.H{"error": "Cloud direct link not available"})
				return
			}

			if len(qualities) > 0 {
				target = qualities[0].URL
				extraHeaders["cookie"] = strings.Join(cookie, "; ")
				useCloud = true
				logger.Infof("使用云盘直链: %s", target)
			}
			// 访问云盘时不允许忽略证书错误
			skipVerify = false
		} else {
			logger.Infof("使用普通代理模式")
		}

		// 通用头部
		extraHeaders["Authorization"] = token
		extraHeaders["connection"] = "keep-alive"

		if !useCloud {
			// 透明转发到target
			logger.Infof("开始透明代理到: %s", target)
			utils.DynamicProxy(c, target, extraHeaders, skipVerify)
			return
		}

		logger.Infof("开始云盘直链处理")
		// 使用云盘处理器处理边下边播请求
		handler := utils.NewCloudStorageHandler(target, extraHeaders["cookie"], skipVerify)
		handler.HandleRequest(c)
		logger.Infof("云盘直链处理完成")
	})

	// 404
	r.NoRoute(func(c *gin.Context) {
		logger.Warnf("收到404请求: %s %s", c.Request.Method, c.Request.URL.Path)
		c.JSON(404, gin.H{"error": "Not Found"})
	})

	logger.Infof("服务器启动在 :2345")
	r.Run(":2345")
}
