package utils

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"proxy/pkg/logger"

	"github.com/allegro/bigcache/v3"
	"github.com/gin-gonic/gin"
)

var (
	// 全局文件大小缓存
	cache     *bigcache.BigCache
	cacheOnce sync.Once
)

const (
	// ChunkSize 固定分块大小 10MiB
	ChunkSize = 10 * 1024 * 1024
	// MaxConcurrentChunks 最大并发分块数 - 串行请求防止网盘风控
	MaxConcurrentChunks = 1
	// PreloadChunks 预加载分块数 - 减少预加载避免过多请求
	PreloadChunks = 1
)

func init() {
	initFileSizeCache()
}

// initFileSizeCache 初始化文件大小缓存
func initFileSizeCache() {
	cacheOnce.Do(func() {
		config := bigcache.DefaultConfig(200 * time.Minute) // 文件大小缓存200分钟
		config.Shards = 1024
		config.MaxEntriesInWindow = 1000 * 10 * 60
		config.MaxEntrySize = 500
		config.HardMaxCacheSize = 512

		var err error
		cache, err = bigcache.New(context.TODO(), config)
		if err != nil {
			logger.Warnf("初始化文件大小缓存失败: %v，使用默认配置", err)
			cache, _ = bigcache.New(context.TODO(), bigcache.DefaultConfig(30*time.Minute))
		}
		logger.Info("文件大小缓存初始化完成")
	})
}

// FileMetaInfo 文件元信息
type FileMetaInfo struct {
	Size        int64
	ContentType string
}

// setCachedFileInfo 缓存文件信息
func setCachedFileInfo(url string, info *FileMetaInfo) error {
	return cache.Set(url, JsonPrintBytes(info))
}

// getCachedFileInfo 获取缓存的文件信息
func getCachedFileInfo(url string) *FileMetaInfo {
	data, err := cache.Get(url)
	if err != nil {
		return nil
	}

	info := &FileMetaInfo{}
	err = json.Unmarshal(data, info)
	if err != nil {
		return nil
	}

	return info
}

// CloudStorageHandler 云盘存储处理器
type CloudStorageHandler struct {
	targetURL  string
	headers    map[string]string
	skipVerify bool
	client     *http.Client
}

// NewCloudStorageHandler 创建云盘存储处理器
func NewCloudStorageHandler(targetURL string, headers map[string]string, skipVerify bool) *CloudStorageHandler {
	return &CloudStorageHandler{
		targetURL:  targetURL,
		headers:    headers,
		skipVerify: skipVerify,
		client: &http.Client{
			Timeout: 60 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					InsecureSkipVerify: skipVerify,
				},
			},
		},
	}
}

// RangeRequest 表示Range请求
type RangeRequest struct {
	Start int64
	End   int64 // -1表示到文件末尾
}

// RangeResponse 表示Range响应
type RangeResponse struct {
	Start      int64
	End        int64
	TotalSize  int64
	Data       []byte
	StatusCode int
}

// parseRange 解析Range头
func parseRange(rangeHeader string) (*RangeRequest, error) {
	if rangeHeader == "" {
		return &RangeRequest{Start: 0, End: -1}, nil
	}

	// 解析 "bytes=start-end" 格式
	if !strings.HasPrefix(rangeHeader, "bytes=") {
		return nil, fmt.Errorf("unsupported range format: %s", rangeHeader)
	}

	rangeStr := strings.TrimPrefix(rangeHeader, "bytes=")
	parts := strings.Split(rangeStr, "-")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid range format: %s", rangeStr)
	}

	start, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid start position: %s", parts[0])
	}

	var end int64 = -1
	if parts[1] != "" {
		end, err = strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid end position: %s", parts[1])
		}
	}

	return &RangeRequest{Start: start, End: end}, nil
}

// getMetaInfo 获取文件大小
func (h *CloudStorageHandler) getMetaInfo() (*FileMetaInfo, error) {
	// 先尝试从缓存获取
	cachedInfo := getCachedFileInfo(h.targetURL)
	if cachedInfo != nil {
		logger.Debugf("从缓存获取文件大小: %d", cachedInfo.Size)
		return cachedInfo, nil
	}

	req, err := http.NewRequest(http.MethodGet, h.targetURL, nil)
	if err != nil {
		return nil, err
	}

	// 设置Range为0-0来获取文件大小
	for k, v := range h.headers {
		req.Header.Set(k, v)
	}
	req.Header.Set("Range", "bytes=0-0")

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusPartialContent {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	contentRange := resp.Header.Get("Content-Range")
	if contentRange == "" {
		return nil, fmt.Errorf("missing Content-Range header")
	}

	// 解析 "bytes 0-0/total" 格式
	parts := strings.Split(contentRange, "/")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid Content-Range format: %s", contentRange)
	}

	totalSize, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid total size: %s", parts[1])
	}

	// 返回Content-Type
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	info := &FileMetaInfo{
		Size:        totalSize,
		ContentType: contentType,
	}

	// 缓存文件信息
	_ = setCachedFileInfo(h.targetURL, info)

	logger.Infof("文件大小: %d bytes, 文件Content-Type: %s", totalSize, contentType)

	return info, nil
}

// sendRangeError 发送416错误
func (h *CloudStorageHandler) sendRangeError(c *gin.Context, totalSize int64) {
	c.Header("Content-Range", fmt.Sprintf("bytes */%d", totalSize))
	c.JSON(http.StatusRequestedRangeNotSatisfiable, gin.H{"error": "Range not satisfiable"})
}

func (h *CloudStorageHandler) HandleRequest(c *gin.Context) {
	h.serveMPVRangeSimple(c)
}

// passthroughHeaders 复制上游部分响应头到下游
func passthroughHeaders(dst gin.ResponseWriter, src *http.Response) {
	for k, vv := range src.Header {
		for _, v := range vv {
			dst.Header().Add(k, v)
		}
	}
}

func (h *CloudStorageHandler) serveMPVRangeSimple(c *gin.Context) {
	// 1) 获取总大小（用于 clamp 以及 200 -> 206 回退）
	info, err := h.getMetaInfo()
	if err != nil {
		logger.Errorf("getMetaInfo failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get meta"})
		return
	}

	// 2) 解析客户端 Range；无 Range 时按 0- 处理
	rr, err := parseRange(c.GetHeader("Range"))
	if err != nil {
		// 容错：当 Range 不合法，返回 416
		logger.Warnf("invalid Range: %v", err)
		h.sendRangeError(c, info.Size)
		return
	}

	start := rr.Start
	if start < 0 {
		start = 0
	}
	if start >= info.Size {
		h.sendRangeError(c, info.Size)
		return
	}

	// 固定只回 10MiB：end = min(start + 10MiB - 1, total-1)
	end := start + ChunkSize - 1
	if end >= info.Size {
		end = info.Size - 1
	}

	// 3) 直连上游（仅调整我们发给上游的 Range）
	req, _ := http.NewRequest("GET", h.targetURL, nil)
	for k, v := range h.headers {
		req.Header.Set(k, v)
	}
	req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", start, end))

	// 建议：拉长超时或置 0 以适配慢速网络的小机器
	// 若你保持原有 h.client 30s 也可，因为 10MiB 通常很快
	resp, err := h.client.Do(req)
	if err != nil {
		logger.Errorf("upstream error: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream unavailable"})
		return
	}
	defer resp.Body.Close()

	// 4) 透传：优先保持上游行为（状态码 + 关键头）
	switch resp.StatusCode {
	case http.StatusPartialContent:
		// 正常 206，直接透传
		passthroughHeaders(c.Writer, resp)
		c.Status(http.StatusPartialContent)

	case http.StatusOK:
		// 少数后端忽略 Range，兜底构造 206 + Content-Range
		// Content-Type 仍来自上游
		if v := resp.Header.Get("Content-Type"); v != "" {
			c.Header("Content-Type", v)
		} else {
			c.Header("Content-Type", "application/octet-stream")
		}
		length := end - start + 1
		c.Header("Accept-Ranges", "bytes")
		c.Header("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, info.Size))
		c.Header("Content-Length", fmt.Sprintf("%d", length))
		c.Status(http.StatusPartialContent)

	default:
		// 其它状态直接转发（如 4xx/5xx）
		// 也可以改为 502，以隐藏上游细节
		logger.Warnf("unexpected upstream status: %d", resp.StatusCode)
		// 尽量把上游错误信息传递回去
		body, _ := io.ReadAll(resp.Body)
		c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
		return
	}

	// 5) 流式转发响应体（无缓存，无拼接）
	if f, ok := c.Writer.(http.Flusher); ok {
		f.Flush()
	}
	if _, err := io.Copy(c.Writer, resp.Body); err != nil {
		// 客户端中断通常会到这里，不必视作错误
		logger.Debugf("client closed / copy ended: %v", err)
		return
	}
}
