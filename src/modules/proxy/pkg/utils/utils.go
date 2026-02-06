package utils

import (
	"crypto/sha1"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"proxy/pkg/logger"

	"github.com/gin-gonic/gin"
)

func JsonPrintBytes(v any) []byte {
	if v == nil {
		return []byte("{}")
	}

	b, err := json.Marshal(v)
	if err != nil {
		return []byte("{}")
	}

	return b
}

// JsonPrint 打印JSON
func JsonPrint(v any) string {
	return string(JsonPrintBytes(v))
}

// StringToUUID 将字符串转换为UUID格式
func StringToUUID(s string) string {
	if len(s) == 0 {
		return "00000000-0000-0000-0000-000000000000"
	}

	hash := sha1.Sum([]byte(s))
	hexStr := hex.EncodeToString(hash[:16])

	return hexStr[:8] + "-" + hexStr[8:12] + "-" + hexStr[12:16] + "-" + hexStr[16:20] + "-" + hexStr[20:]
}

// PassthroughHeaders 从HTTP请求中提取需要传递的头信息
func PassthroughHeaders(req *http.Request) map[string]string {
	headers := make(map[string]string)

	// 需要传递的头列表
	passHeaders := []string{
		"User-Agent",
		"Accept",
		"Accept-Language",
		"Accept-Encoding",
		"Cache-Control",
		"Pragma",
		"Range",
		"If-Range",
		"If-Modified-Since",
		"If-None-Match",
	}

	for _, header := range passHeaders {
		if value := req.Header.Get(header); value != "" {
			headers[header] = value
		}
	}

	return headers
}

// DynamicProxy 实现流式管道代理，支持自动跟随重定向
func DynamicProxy(c *gin.Context, targetURL string, extraHeaders map[string]string, skipVerify bool) {
	// 1. 创建 HTTP 请求
	// 注意：使用 c.Request.Context()，这样客户端断开连接时，下载也会自动停止
	req, err := http.NewRequestWithContext(c.Request.Context(), c.Request.Method, targetURL, c.Request.Body)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to create request"})
		return
	}

	// 2. 复制客户端的 Header 到新请求
	// 我们需要小心过滤掉一些 Hop-by-hop 的 Header
	skipHeaders := map[string]bool{
		"Host":                true, // Host 由 http.Client 根据 URL 自动设置
		"Content-Length":      true, // 由 req.Body 自动处理
		"Transfer-Encoding":   true,
		"Connection":          true,
		"Keep-Alive":          true,
		"Proxy-Authenticate":  true,
		"Proxy-Authorization": true,
		"Te":                  true,
		"Trailers":            true,
		"Upgrade":             true,
	}

	for k, v := range c.Request.Header {
		if !skipHeaders[k] {
			for _, vv := range v {
				req.Header.Add(k, vv)
			}
		}
	}

	// 添加额外的 Header
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}

	// 3. 配置 HTTP Client
	client := &http.Client{
		// 自动跟随重定向是 http.Client 的默认行为，无需额外配置
		// 只要不设置 CheckRedirect，它就会自动处理 302 直到拿到 200
		Timeout: 0, // 设置为 0，因为下载大文件或视频流需要长时间保持连接
		Transport: &http.Transport{
			TLSClientConfig:    &tls.Config{InsecureSkipVerify: skipVerify},
			MaxIdleConns:       100,
			IdleConnTimeout:    90 * time.Second,
			DisableCompression: true, // 对于视频流，通常不需要压缩，且压缩可能导致流式传输问题
		},
	}

	// 4. 发起请求 (这一步会自动处理 302 跳转)
	resp, err := client.Do(req)
	if err != nil {
		logger.Errorf("代理请求失败: %v", err)
		// 如果客户端已经断开，就不返回错误了
		if c.Request.Context().Err() == nil {
			c.Status(http.StatusBadGateway)
		}
		return
	}
	defer resp.Body.Close()

	// 5. 将目标服务器的响应 Header 复制回给客户端
	for k, v := range resp.Header {
		// 同样过滤掉一些 Header
		if !skipHeaders[k] {
			for _, vv := range v {
				c.Writer.Header().Add(k, vv)
			}
		}
	}

	// 设置状态码
	c.Status(resp.StatusCode)

	// 6. 关键步骤：建立数据管道
	// 直接将上游的 Body 流式拷贝到 ResponseWriter
	// 这样数据来多少发多少，不会占用服务器内存
	buf := make([]byte, 32*1024) // 32KB 缓冲区
	_, err = io.CopyBuffer(c.Writer, resp.Body, buf)

	if err != nil {
		// 这里的错误通常是因为客户端（播放器）关闭了连接，或者是网络中断
		// 不需要 panic，只需要记录日志即可
		logger.Debugf("流式传输中断 (可能是客户端主动断开): %v", err)
	}
}
