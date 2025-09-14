package utils

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// TestCloudStorageHandlerIntegration 集成测试云盘处理模块
func TestCloudStorageHandlerIntegration(t *testing.T) {
	// 创建模拟的云盘服务器
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 模拟文件大小为100MiB
		fileSize := int64(100 * 1024 * 1024)

		rangeHeader := r.Header.Get("Range")
		if rangeHeader == "" {
			// 没有Range头，返回整个文件
			w.Header().Set("Content-Length", fmt.Sprintf("%d", fileSize))
			w.WriteHeader(http.StatusOK)
			// 返回模拟数据
			data := make([]byte, 1024) // 只返回1KB用于测试
			for i := range data {
				data[i] = byte(i % 256)
			}
			w.Write(data)
			return
		}

		// 解析Range请求
		if !strings.HasPrefix(rangeHeader, "bytes=") {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		rangeStr := strings.TrimPrefix(rangeHeader, "bytes=")
		parts := strings.Split(rangeStr, "-")
		if len(parts) != 2 {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		start := int64(0)
		end := fileSize - 1

		if parts[0] != "" {
			fmt.Sscanf(parts[0], "%d", &start)
		}
		if parts[1] != "" {
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

		// 返回模拟数据
		data := make([]byte, contentLength)
		for i := int64(0); i < contentLength; i++ {
			data[i] = byte((start + i) % 256)
		}
		w.Write(data)
	}))
	defer mockServer.Close()

	// 测试场景1: 基本Range请求
	t.Run("基本Range请求", func(t *testing.T) {
		// 由于我们无法直接创建Gin上下文，我们需要测试内部方法
		// 这里我们直接测试parseRange和alignToChunk函数
		rangeReq, err := parseRange("bytes=0-1023", 100*1024*1024)
		if err != nil {
			t.Fatalf("解析Range失败: %v", err)
		}

		if rangeReq.Start != 0 || rangeReq.End != 1023 {
			t.Errorf("Range解析错误，期望: {0, 1023}, 实际: {%d, %d}", rangeReq.Start, rangeReq.End)
		}
	})

	// 测试场景2: mpv风格的Range请求
	t.Run("mpv风格Range请求", func(t *testing.T) {
		rangeReq, err := parseRange("bytes=879259368-", 879371816)
		if err != nil {
			t.Fatalf("解析mpv Range失败: %v", err)
		}

		if rangeReq.Start != 879259368 || rangeReq.End != -1 {
			t.Errorf("mpv Range解析错误，期望: {879259368, -1}, 实际: {%d, %d}", rangeReq.Start, rangeReq.End)
		}

		// 测试分块对齐
		chunkStart := alignToChunk(rangeReq.Start, false)
		expectedChunkStart := int64((879259368 / (10 * 1024 * 1024)) * (10 * 1024 * 1024))

		if chunkStart != expectedChunkStart {
			t.Errorf("分块对齐错误，期望: %d, 实际: %d", expectedChunkStart, chunkStart)
		}
	})

	// 测试场景3: 跨分块请求
	t.Run("跨分块请求", func(t *testing.T) {
		rangeReq, err := parseRange("bytes=5242880-15728639", 100*1024*1024) // 5MiB-15MiB
		if err != nil {
			t.Fatalf("解析跨分块Range失败: %v", err)
		}

		// 计算期望的分块
		originStart := alignToChunk(rangeReq.Start, false) // 向下对齐到10MiB边界
		originEnd := alignToChunk(rangeReq.End, true) - 1  // 向上对齐到10MiB边界-1

		expectedStart := int64(0)      // 0MiB
		expectedEnd := int64(20971519) // 20MiB-1

		if originStart != expectedStart || originEnd != expectedEnd {
			t.Errorf("跨分块计算错误，期望: {%d, %d}, 实际: {%d, %d}", expectedStart, expectedEnd, originStart, originEnd)
		}
	})

	// 测试场景4: 实际HTTP请求测试
	t.Run("实际HTTP请求", func(t *testing.T) {
		client := &http.Client{Timeout: 10 * time.Second}

		// 测试基本Range请求
		req, _ := http.NewRequest("GET", mockServer.URL+"/test.mp4", nil)
		req.Header.Set("Range", "bytes=0-1023")

		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("HTTP请求失败: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusPartialContent {
			t.Errorf("期望状态码206，实际: %d", resp.StatusCode)
		}

		contentRange := resp.Header.Get("Content-Range")
		if contentRange == "" {
			t.Error("缺少Content-Range头")
		}

		data, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatalf("读取响应失败: %v", err)
		}

		if len(data) != 1024 {
			t.Errorf("期望数据长度1024，实际: %d", len(data))
		}

		// 验证数据内容
		for i, b := range data {
			expected := byte(i % 256)
			if b != expected {
				t.Errorf("数据验证失败，位置%d: 期望%d，实际%d", i, expected, b)
				break
			}
		}
	})
}

// TestMpvRealWorldScenarios 测试mpv的真实世界场景
func TestMpvRealWorldScenarios(t *testing.T) {
	fileSize := int64(879371816) // 实际视频文件大小

	scenarios := []struct {
		name         string
		rangeHeader  string
		expectedDesc string
	}{
		{
			name:         "mpv初始缓冲",
			rangeHeader:  "bytes=0-",
			expectedDesc: "从文件开头开始，请求一个分块",
		},
		{
			name:         "mpv跳转到中间",
			rangeHeader:  "bytes=439685908-",
			expectedDesc: "跳转到文件中间位置",
		},
		{
			name:         "mpv跳转到末尾",
			rangeHeader:  "bytes=879259368-",
			expectedDesc: "跳转到文件末尾附近",
		},
		{
			name:         "mpv精确范围请求",
			rangeHeader:  "bytes=10485760-20971519",
			expectedDesc: "请求10MiB-20MiB范围",
		},
	}

	for _, scenario := range scenarios {
		t.Run(scenario.name, func(t *testing.T) {
			rangeReq, err := parseRange(scenario.rangeHeader, fileSize)
			if err != nil {
				t.Fatalf("解析Range失败: %v", err)
			}

			// 计算分块
			var chunks []RangeRequest
			chunkSize := int64(10 * 1024 * 1024) // 10MiB

			if rangeReq.End == -1 {
				// bytes=start- 格式
				chunkStart := (rangeReq.Start / chunkSize) * chunkSize
				chunkEnd := chunkStart + chunkSize - 1
				if chunkEnd >= fileSize {
					chunkEnd = fileSize - 1
				}
				chunks = append(chunks, RangeRequest{Start: chunkStart, End: chunkEnd})
			} else {
				// bytes=start-end 格式
				originStart := (rangeReq.Start / chunkSize) * chunkSize
				originEnd := ((rangeReq.End+chunkSize)/chunkSize)*chunkSize - 1
				if originEnd >= fileSize {
					originEnd = fileSize - 1
				}

				for start := originStart; start <= originEnd; start += chunkSize {
					end := start + chunkSize - 1
					if end > originEnd {
						end = originEnd
					}
					chunks = append(chunks, RangeRequest{Start: start, End: end})
				}
			}

			t.Logf("%s: %s", scenario.name, scenario.expectedDesc)
			t.Logf("原始Range: %s", scenario.rangeHeader)
			t.Logf("解析结果: start=%d, end=%d", rangeReq.Start, rangeReq.End)
			t.Logf("生成分块数量: %d", len(chunks))

			for i, chunk := range chunks {
				t.Logf("分块%d: bytes=%d-%d (%d bytes)",
					i+1, chunk.Start, chunk.End, chunk.End-chunk.Start+1)
			}

			// 验证分块不超过最大并发数
			if len(chunks) > 2 {
				t.Errorf("分块数量超过最大并发数: %d > 2", len(chunks))
			}
		})
	}
}
