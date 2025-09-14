package fnapi

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/allegro/bigcache/v3"
)

// 全局缓存实例
var (
	globalCache *bigcache.BigCache
	cacheOnce   sync.Once
)

// initGlobalCache 初始化全局缓存
func initGlobalCache() {
	cacheOnce.Do(func() {
		config := bigcache.DefaultConfig(10 * time.Minute)
		config.Shards = 1024
		config.MaxEntriesInWindow = 1000 * 10 * 60
		config.MaxEntrySize = 500
		config.HardMaxCacheSize = 512

		var err error
		globalCache, err = bigcache.New(context.TODO(), config)
		if err != nil {
			log.Printf("初始化全局缓存失败: %v", err)
			// 如果初始化失败，使用默认配置
			globalCache, _ = bigcache.New(context.TODO(), bigcache.DefaultConfig(10*time.Minute))
		}
		log.Println("全局缓存初始化完成")
	})
}

// ApiService API服务
type ApiService struct {
	baseURL    string
	token      string
	skipVerify bool
	client     *http.Client
}

// NewApiService 创建API服务实例
func NewApiService(baseURL, token string, skipVerify bool) *ApiService {
	initGlobalCache()

	// 创建HTTP客户端
	client := &http.Client{
		Timeout: time.Duration(DefaultTimeout) * time.Millisecond,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: skipVerify,
			},
		},
	}

	return &ApiService{
		baseURL:    baseURL,
		token:      token,
		skipVerify: skipVerify,
		client:     client,
	}
}

// GetBaseURL 获取当前API基础URL
func (s *ApiService) GetBaseURL() string {
	return s.baseURL
}

// setCache 设置缓存
func setCache(key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return globalCache.Set(key, data)
}

// getCache 获取缓存
func getCache(key string, dest interface{}) (bool, error) {
	data, err := globalCache.Get(key)
	if err != nil {
		return false, err
	}

	err = json.Unmarshal(data, dest)
	if err != nil {
		return false, err
	}
	return true, nil
}

// generateCacheKey 生成缓存键
func generateCacheKey(method, url string, params interface{}) string {
	key := fmt.Sprintf("%s:%s", method, url)
	if params != nil {
		paramsStr, _ := json.Marshal(params)
		key += ":" + string(paramsStr)
	}
	return key
}

// Login 用户登录
func (s *ApiService) Login(username, password string) (*ApiResponse[interface{}], error) {
	return Request[interface{}](s.client, s.baseURL, "/v/api/v1/login", MethodPOST, s.token, LoginData{
		AppName:  "trimemedia-web",
		Username: username,
		Password: password,
	}, nil, 0, 0)
}

// Logout 用户登出
func (s *ApiService) Logout() (*ApiResponse[interface{}], error) {
	return Request[interface{}](s.client, s.baseURL, "/v/api/v1/logout", MethodPOST, s.token, nil, nil, 0, 0)
}

// GetUserInfo 获取用户信息
func (s *ApiService) GetUserInfo() (*ApiResponse[UserInfo], error) {
	return Request[UserInfo](s.client, s.baseURL, "/v/api/v1/user/info", MethodGET, s.token, nil, nil, 0, 0)
}

// GetPlayInfo 获取视频播放信息
func (s *ApiService) GetPlayInfo(itemGUID string) (*ApiResponse[PlayInfo], error) {
	data := PlayInfoData{ItemGUID: itemGUID}
	return Request[PlayInfo](s.client, s.baseURL, "/v/api/v1/play/info", MethodPOST, s.token, data, nil, 0, 0)
}

// GetPlayQuality 获取播放质量列表
func (s *ApiService) GetPlayQuality(mediaGUID string) (*ApiResponse[PlayQualityResponse], error) {
	return Request[PlayQualityResponse](s.client, s.baseURL, "/v/api/v1/play/quality", MethodPOST, s.token, map[string]string{
		"media_guid": mediaGUID,
	}, nil, 0, 0)
}

// GetStreamList 获取流列表
func (s *ApiService) GetStreamList(itemGUID string) (*ApiResponse[StreamListResponse], error) {
	return Request[StreamListResponse](s.client, s.baseURL, fmt.Sprintf("/v/api/v1/stream/list/%s", itemGUID), MethodGET, s.token, nil, nil, 0, 0)
}

// GetEpisodeList 获取播放列表
func (s *ApiService) GetEpisodeList(id string) (*ApiResponse[[]PlayListItem], error) {
	return Request[[]PlayListItem](s.client, s.baseURL, fmt.Sprintf("/v/api/v1/episode/list/%s", id), MethodGET, s.token, nil, nil, 0, 0)
}

// GetVideoURL 获取视频直链地址
func (s *ApiService) GetVideoURL(mediaGUID string) string {
	return fmt.Sprintf("%s/v/api/v1/media/range/%s", s.baseURL, mediaGUID)
}

// SetWatched 设置视频为已观看状态
func (s *ApiService) SetWatched(itemGUID string) (*ApiResponse[interface{}], error) {
	return Request[interface{}](s.client, s.baseURL, "/v/api/v1/item/watched", MethodPOST, s.token, WatchedData{
		ItemGUID: itemGUID,
	}, nil, 0, 0)
}

// RecordPlayStatus 记录播放状态
func (s *ApiService) RecordPlayStatus(statusData PlayStatusData) (*ApiResponse[interface{}], error) {
	return Request[interface{}](s.client, s.baseURL, "/v/api/v1/play/record", MethodPOST, s.token, statusData, nil, 0, 0)
}

// GetStream 获取流信息
func (s *ApiService) GetStream(mediaGUID, ip string) (*ApiResponse[StreamResponse], error) {
	data := StreamRequestData{
		Header: struct {
			UserAgent []string `json:"User-Agent"`
		}{
			UserAgent: []string{"trim_player"},
		},
		Level:     1,
		MediaGUID: mediaGUID,
		IP:        ip,
	}
	return Request[StreamResponse](s.client, s.baseURL, "/v/api/v1/stream", MethodPOST, s.token, data, nil, 0, 0)
}

// GetUserInfoCached 获取用户信息（带缓存）
func (s *ApiService) GetUserInfoCached() (*ApiResponse[UserInfo], error) {
	cacheKey := generateCacheKey("GET", "/v/api/v1/user/info", nil)
	var cachedResp ApiResponse[UserInfo]
	if exists, err := getCache(cacheKey, &cachedResp); exists && err == nil {
		return &cachedResp, nil
	}

	resp, err := s.GetUserInfo()
	if err == nil && resp.Success {
		setCache(cacheKey, resp)
	}
	return resp, err
}

// GetPlayInfoCached 获取视频播放信息（带缓存）
func (s *ApiService) GetPlayInfoCached(itemGUID string) (*ApiResponse[PlayInfo], error) {
	cacheKey := generateCacheKey("POST", "/v/api/v1/play/info", PlayInfoData{ItemGUID: itemGUID})
	var cachedResp ApiResponse[PlayInfo]
	if exists, err := getCache(cacheKey, &cachedResp); exists && err == nil {
		return &cachedResp, nil
	}

	resp, err := s.GetPlayInfo(itemGUID)
	if err == nil && resp.Success {
		setCache(cacheKey, resp)
	}
	return resp, err
}

// GetPlayQualityCached 获取播放质量列表（带缓存）
func (s *ApiService) GetPlayQualityCached(mediaGUID string) (*ApiResponse[PlayQualityResponse], error) {
	cacheKey := generateCacheKey("POST", "/v/api/v1/play/quality", map[string]string{"media_guid": mediaGUID})
	var cachedResp ApiResponse[PlayQualityResponse]
	if exists, err := getCache(cacheKey, &cachedResp); exists && err == nil {
		return &cachedResp, nil
	}

	resp, err := s.GetPlayQuality(mediaGUID)
	if err == nil && resp.Success {
		setCache(cacheKey, resp)
	}
	return resp, err
}

// GetStreamListCached 获取流列表（带缓存）
func (s *ApiService) GetStreamListCached(itemGUID string) (*ApiResponse[StreamListResponse], error) {
	cacheKey := generateCacheKey("GET", fmt.Sprintf("/v/api/v1/stream/list/%s", itemGUID), nil)
	var cachedResp ApiResponse[StreamListResponse]
	if exists, err := getCache(cacheKey, &cachedResp); exists && err == nil {
		return &cachedResp, nil
	}

	resp, err := s.GetStreamList(itemGUID)
	if err == nil && resp.Success {
		setCache(cacheKey, resp)
	}
	return resp, err
}

// GetStreamCached 获取流信息（带缓存）
func (s *ApiService) GetStreamCached(mediaGUID, ip string) (*ApiResponse[StreamResponse], error) {
	data := StreamRequestData{
		Header: struct {
			UserAgent []string `json:"User-Agent"`
		}{
			UserAgent: []string{"trim_player"},
		},
		Level:     1,
		MediaGUID: mediaGUID,
		IP:        ip,
	}
	cacheKey := generateCacheKey("POST", "/v/api/v1/stream", data)
	var cachedResp ApiResponse[StreamResponse]
	if exists, err := getCache(cacheKey, &cachedResp); exists && err == nil {
		return &cachedResp, nil
	}

	resp, err := s.GetStream(mediaGUID, ip)
	if err == nil && resp.Success {
		setCache(cacheKey, resp)
	}
	return resp, err
}
