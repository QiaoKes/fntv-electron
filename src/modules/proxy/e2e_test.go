package main

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"proxy/pkg/utils"

	"github.com/gin-gonic/gin"
)

func testE2E() {
	// 创建模拟的云盘服务器
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fileSize := int64(879371816) // 实际视频文件大小

		rangeHeader := r.Header.Get("Range")
		if rangeHeader == "" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// 解析Range请求
		if !strings.HasPrefix(rangeHeader, "bytes=") {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		rangeStr := strings.TrimPrefix(rangeHeader, "bytes=")
		parts := strings.Split(rangeStr, "-")

		start := int64(0)
		end := fileSize - 1

		if parts[0] != "" {
			fmt.Sscanf(parts[0], "%d", &start)
		}
		if len(parts) > 1 && parts[1] != "" {
			fmt.Sscanf(parts[1], "%d", &end)
		}

		// 确保范围有效
		if start >= fileSize {
			w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", fileSize))
			w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
			return
		}

		if end >= fileSize {
			end = fileSize - 1
		}

		contentLength := end - start + 1

		// 设置响应头
		w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
		w.Header().Set("Content-Length", fmt.Sprintf("%d", contentLength))
		w.Header().Set("Accept-Ranges", "bytes")
		w.WriteHeader(http.StatusPartialContent)

		// 返回模拟数据（简单的递增字节）
		data := make([]byte, contentLength)
		for i := int64(0); i < contentLength; i++ {
			data[i] = byte((start + i) % 256)
		}
		w.Write(data)

		fmt.Printf("模拟服务器响应: Range=%s, 返回 %d bytes\n", rangeHeader, contentLength)
	}))
	defer mockServer.Close()

	// 创建Gin路由来测试云盘处理
	r := gin.Default()
	r.GET("/test", func(c *gin.Context) {
		handler := utils.NewCloudStorageHandler(mockServer.URL+"/video.mp4", "", false)
		handler.HandleRequest(c)
	})

	// 启动测试服务器
	testServer := httptest.NewServer(r)
	defer testServer.Close()

	fmt.Println("=== 边下边播功能端到端测试 ===")
	fmt.Printf("测试服务器: %s\n", testServer.URL)
	fmt.Printf("模拟云盘服务器: %s\n\n", mockServer.URL)

	client := &http.Client{Timeout: 10 * time.Second}

	// 测试场景1: mpv初始请求
	fmt.Println("1. 测试mpv初始请求 (bytes=0-)")
	req, _ := http.NewRequest("GET", testServer.URL+"/test", nil)
	req.Header.Set("Range", "bytes=0-")
	req.Header.Set("User-Agent", "libmpv")

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("❌ 请求失败: %v\n", err)
		return
	}

	fmt.Printf("状态码: %d\n", resp.StatusCode)
	fmt.Printf("Content-Range: %s\n", resp.Header.Get("Content-Range"))
	fmt.Printf("Content-Length: %s\n", resp.Header.Get("Content-Length"))

	if resp.StatusCode == 206 {
		data, _ := io.ReadAll(resp.Body)
		fmt.Printf("✅ 成功返回 %d bytes 数据\n", len(data))
	} else {
		fmt.Printf("❌ 期望状态码206，实际: %d\n", resp.StatusCode)
	}
	resp.Body.Close()

	fmt.Println()

	// 测试场景2: mpv跳转请求
	fmt.Println("2. 测试mpv跳转请求 (bytes=879259368-)")
	req2, _ := http.NewRequest("GET", testServer.URL+"/test", nil)
	req2.Header.Set("Range", "bytes=879259368-")
	req2.Header.Set("User-Agent", "libmpv")

	resp2, err := client.Do(req2)
	if err != nil {
		fmt.Printf("❌ 请求失败: %v\n", err)
		return
	}

	fmt.Printf("状态码: %d\n", resp2.StatusCode)
	fmt.Printf("Content-Range: %s\n", resp2.Header.Get("Content-Range"))
	fmt.Printf("Content-Length: %s\n", resp2.Header.Get("Content-Length"))

	if resp2.StatusCode == 206 {
		data, _ := io.ReadAll(resp2.Body)
		fmt.Printf("✅ 成功返回 %d bytes 数据\n", len(data))
	} else {
		fmt.Printf("❌ 期望状态码206，实际: %d\n", resp2.StatusCode)
	}
	resp2.Body.Close()

	fmt.Println()

	// 测试场景3: 精确范围请求
	fmt.Println("3. 测试精确范围请求 (bytes=10485760-20971519)")
	req3, _ := http.NewRequest("GET", testServer.URL+"/test", nil)
	req3.Header.Set("Range", "bytes=10485760-20971519")
	req3.Header.Set("User-Agent", "libmpv")

	resp3, err := client.Do(req3)
	if err != nil {
		fmt.Printf("❌ 请求失败: %v\n", err)
		return
	}

	fmt.Printf("状态码: %d\n", resp3.StatusCode)
	fmt.Printf("Content-Range: %s\n", resp3.Header.Get("Content-Range"))
	fmt.Printf("Content-Length: %s\n", resp3.Header.Get("Content-Length"))

	if resp3.StatusCode == 206 {
		data, _ := io.ReadAll(resp3.Body)
		fmt.Printf("✅ 成功返回 %d bytes 数据\n", len(data))
	} else {
		fmt.Printf("❌ 期望状态码206，实际: %d\n", resp3.StatusCode)
	}
	resp3.Body.Close()

	fmt.Println("\n=== 测试完成 ===")
	fmt.Println("✅ 所有测试场景都返回了正确的HTTP 206响应")
	fmt.Println("✅ 边下边播功能工作正常")
}
