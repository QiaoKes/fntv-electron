package logic

import (
	"github.com/gin-gonic/gin"
	"proxy/internal/logic/api"
	"proxy/pkg/logger"
)

// RunApiServer 启动 API 服务器
func RunApiServer(addr string) error {
	r := gin.Default()

	r.GET("/api/v1/playvideo/:itemGuid", api.PlayVideoHandler)

	// 404 路由
	r.NoRoute(func(c *gin.Context) {
		logger.Warnf("收到404请求: %s %s", c.Request.Method, c.Request.URL.Path)
		c.JSON(404, gin.H{"error": "Not Found"})
	})

	logger.Infof("服务器启动在 :22345")

	err := r.Run(addr)
	if err != nil {
		return err
	}

	return nil
}
