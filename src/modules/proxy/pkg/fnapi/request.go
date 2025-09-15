package fnapi

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"proxy/pkg/logger"
)

const (
	apiKey    = "NDzZTVxnRKP8Z0jXg1VAMonaG8akvh"
	apiSecret = "16CCEB3D-AB42-077D-36A1-F355324E4237"
)

// ApiResponse API响应
type ApiResponse[T any] struct {
	Success          bool   `json:"success"`
	Data             T      `json:"data,omitempty"`
	Message          string `json:"message,omitempty"`
	CertificateError bool   `json:"certificateError,omitempty"`
}

// FnApiResponseData 飞牛API响应数据
type FnApiResponseData[T any] struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data T      `json:"data"`
}

// HttpMethod HTTP方法
type HttpMethod string

const (
	MethodGET    HttpMethod = "GET"
	MethodPOST   HttpMethod = "POST"
	MethodPUT    HttpMethod = "PUT"
	MethodDELETE HttpMethod = "DELETE"
)

// GetMd5 计算MD5哈希
func GetMd5(text string) string {
	hash := md5.Sum([]byte(text))
	return fmt.Sprintf("%x", hash)
}

// GenerateRandomDigits 生成随机数字字符串
func GenerateRandomDigits(start, end int) string {
	if start >= end {
		return strconv.Itoa(start)
	}
	return strconv.Itoa(rand.Intn(end-start) + start)
}

// GenFnAuthx 生成授权签名
func GenFnAuthx(url string, data interface{}) string {
	nonce := GenerateRandomDigits(100000, 1000000)
	timestamp := time.Now().Unix()
	var dataJson string
	if data != nil {
		dataBytes, _ := json.Marshal(data)
		dataJson = string(dataBytes)
	}
	dataJsonMd5 := GetMd5(dataJson)

	signArray := []string{
		apiKey,
		url,
		nonce,
		strconv.FormatInt(timestamp, 10),
		dataJsonMd5,
		apiSecret,
	}
	signStr := strings.Join(signArray, "_")
	finalSign := GetMd5(signStr)

	return fmt.Sprintf("nonce=%s&timestamp=%d&sign=%s", nonce, timestamp, finalSign)
}

const DefaultTimeout = 10000 // 默认超时时间（毫秒）

// Request 发送API请求
func Request[T any](client *http.Client, baseURL, url string, method HttpMethod, token string, data interface{}, extraHeaders map[string]string, timeout, tryTimes int) (*ApiResponse[T], error) {
	if tryTimes <= 0 {
		tryTimes = 5
	}
	if timeout <= 0 {
		timeout = DefaultTimeout
	}

	fullURL := baseURL + url

	// 为POST/PUT请求添加随机数防重放
	if method == MethodPOST || method == MethodPUT {
		if data == nil {
			data = map[string]interface{}{}
		}
		// 这里假设data是map，可以添加nonce
		if m, ok := data.(map[string]interface{}); ok {
			nonce := GenerateRandomDigits(100000, 1000000)
			m["nonce"] = nonce
			logger.Debugf("为%s请求添加nonce: %s", string(method), nonce)
		}
	}

	authx := GenFnAuthx(url, data)

	headers := map[string]string{
		"Content-Type":  "application/json",
		"Authorization": token,
		"Authx":         authx,
	}
	for k, v := range extraHeaders {
		headers[k] = v
	}

	var lastErr error
	for attempt := 0; attempt <= tryTimes; attempt++ {
		logger.Debugf("尝试第%d次请求: %s", attempt+1, fullURL)

		var req *http.Request
		var err error

		var body io.Reader
		if data != nil {
			dataBytes, _ := json.Marshal(data)
			body = strings.NewReader(string(dataBytes))
			logger.Debugf("请求体大小: %d bytes", len(dataBytes))
		}

		req, err = http.NewRequest(string(method), fullURL, body)
		if err != nil {
			logger.Errorf("创建HTTP请求失败: %v", err)
			return nil, err
		}

		for k, v := range headers {
			req.Header.Set(k, v)
		}

		resp, err := client.Do(req)
		if err != nil {
			logger.Warnf("HTTP请求失败 (尝试%d/%d): %v", attempt+1, tryTimes+1, err)
			lastErr = err
			time.Sleep(100 * time.Millisecond)
			continue
		}
		defer resp.Body.Close()

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			logger.Warnf("读取响应体失败 (尝试%d/%d): %v", attempt+1, tryTimes+1, err)
			lastErr = err
			time.Sleep(100 * time.Millisecond)
			continue
		}

		logger.Debugf("收到响应: 状态码=%d, 响应体大小=%d bytes", resp.StatusCode, len(respBody))

		var fnResp FnApiResponseData[T]
		if err := json.Unmarshal(respBody, &fnResp); err != nil {
			logger.Warnf("解析JSON响应失败 (尝试%d/%d): %v", attempt+1, tryTimes+1, err)
			lastErr = err
			time.Sleep(100 * time.Millisecond)
			continue
		}

		// 处理签名错误的重试逻辑
		if fnResp.Code == 5000 && fnResp.Msg == "invalid sign" {
			logger.Warnf("签名错误，重试中 (尝试%d/%d): %s", attempt+1, tryTimes+1, fnResp.Msg)
			if attempt >= tryTimes {
				logger.Errorf("签名错误重试次数过多")
				return &ApiResponse[T]{
					Success: false,
					Message: fmt.Sprintf("尝试次数过多 try_times = %d", attempt+1),
				}, nil
			}
			time.Sleep(100 * time.Millisecond)
			continue
		}

		// 处理业务错误
		if fnResp.Code != 0 {
			logger.Errorf("API业务错误: 代码=%d, 消息=%s", fnResp.Code, fnResp.Msg)
			return &ApiResponse[T]{
				Success: false,
				Message: fnResp.Msg,
			}, nil
		}

		logger.Infof("API请求成功: %s %s", string(method), url)
		return &ApiResponse[T]{
			Success: true,
			Data:    fnResp.Data,
		}, nil
	}

	logger.Errorf("API请求最终失败: %v", lastErr)
	return &ApiResponse[T]{
		Success: false,
		Message: fmt.Sprintf("请求失败: %v", lastErr),
	}, lastErr
}
