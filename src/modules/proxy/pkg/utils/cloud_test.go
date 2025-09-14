package utils

import (
	"testing"
)

// TestParseRange 测试Range解析功能
func TestParseRange(t *testing.T) {
	tests := []struct {
		name        string
		rangeHeader string
		totalSize   int64
		expected    *RangeRequest
		expectError bool
	}{
		{
			name:        "完整Range请求 bytes=0-1023",
			rangeHeader: "bytes=0-1023",
			totalSize:   10000,
			expected:    &RangeRequest{Start: 0, End: 1023},
			expectError: false,
		},
		{
			name:        "mpv格式 bytes=start-",
			rangeHeader: "bytes=879259368-",
			totalSize:   879371816,
			expected:    &RangeRequest{Start: 879259368, End: -1},
			expectError: false,
		},
		{
			name:        "空Range头",
			rangeHeader: "",
			totalSize:   10000,
			expected:    &RangeRequest{Start: 0, End: -1},
			expectError: false,
		},
		{
			name:        "无效格式",
			rangeHeader: "invalid",
			totalSize:   10000,
			expected:    nil,
			expectError: true,
		},
		{
			name:        "不支持的格式",
			rangeHeader: "other=0-1023",
			totalSize:   10000,
			expected:    nil,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseRange(tt.rangeHeader, tt.totalSize)

			if tt.expectError {
				if err == nil {
					t.Errorf("期望错误但没有得到错误")
				}
				return
			}

			if err != nil {
				t.Errorf("不期望的错误: %v", err)
				return
			}

			if result.Start != tt.expected.Start || result.End != tt.expected.End {
				t.Errorf("解析结果不匹配，期望: %+v, 实际: %+v", tt.expected, result)
			}
		})
	}
}

// TestAlignToChunk 测试分块对齐功能
func TestAlignToChunk(t *testing.T) {
	tests := []struct {
		name     string
		offset   int64
		alignUp  bool
		expected int64
	}{
		{
			name:     "向下对齐 - 已在边界",
			offset:   10485760, // 10MiB
			alignUp:  false,
			expected: 10485760,
		},
		{
			name:     "向下对齐 - 需要对齐",
			offset:   879259368,
			alignUp:  false,
			expected: 879259368 - (879259368 % ChunkSize), // 向下对齐到10MiB边界
		},
		{
			name:     "向上对齐",
			offset:   879259368,
			alignUp:  true,
			expected: ((879259368 + ChunkSize - 1) / ChunkSize) * ChunkSize,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := alignToChunk(tt.offset, tt.alignUp)
			if result != tt.expected {
				t.Errorf("对齐结果不匹配，期望: %d, 实际: %d", tt.expected, result)
			}
		})
	}
}

// TestMpvRangeScenarios 测试mpv播放器的典型Range请求场景
func TestMpvRangeScenarios(t *testing.T) {
	// 模拟一个879371816字节的视频文件
	fileSize := int64(879371816)

	tests := []struct {
		name           string
		rangeHeader    string
		expectedChunks int // 期望的分块数量
		description    string
	}{
		{
			name:           "mpv初始请求",
			rangeHeader:    "bytes=0-",
			expectedChunks: 1, // 应该只请求一个分块（前10MiB）
			description:    "mpv通常从文件开头开始请求",
		},
		{
			name:           "mpv跳转请求",
			rangeHeader:    "bytes=879259368-",
			expectedChunks: 1, // 应该只请求一个分块
			description:    "mpv跳转到文件末尾附近",
		},
		{
			name:           "完整Range请求",
			rangeHeader:    "bytes=10485760-20971519", // 10MiB-20MiB
			expectedChunks: 1,                         // 刚好一个分块
			description:    "请求完整的10MiB分块",
		},
		{
			name:           "跨分块请求",
			rangeHeader:    "bytes=5242880-15728639", // 5MiB-15MiB
			expectedChunks: 2,                        // 跨越两个分块
			description:    "请求跨越多个分块的数据",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 解析Range请求
			rangeReq, err := parseRange(tt.rangeHeader, fileSize)
			if err != nil {
				t.Fatalf("解析Range失败: %v", err)
			}

			// 模拟HandleRangeRequest中的分块计算逻辑
			var chunks []RangeRequest

			if rangeReq.End == -1 {
				// bytes=start- 格式，给一个向前窗口
				chunkStart := alignToChunk(rangeReq.Start, false)
				chunkEnd := chunkStart + ChunkSize - 1
				if chunkEnd >= fileSize {
					chunkEnd = fileSize - 1
				}
				chunks = append(chunks, RangeRequest{Start: chunkStart, End: chunkEnd})
			} else {
				// bytes=start-end 格式
				originStart := alignToChunk(rangeReq.Start, false)
				originEnd := alignToChunk(rangeReq.End, true) - 1
				if originEnd >= fileSize {
					originEnd = fileSize - 1
				}

				// 生成分块请求
				for start := originStart; start <= originEnd; start += ChunkSize {
					end := start + ChunkSize - 1
					if end > originEnd {
						end = originEnd
					}
					chunks = append(chunks, RangeRequest{Start: start, End: end})
				}
			}

			// 验证分块数量
			if len(chunks) != tt.expectedChunks {
				t.Errorf("%s: 期望分块数量 %d, 实际 %d", tt.description, tt.expectedChunks, len(chunks))
				for i, chunk := range chunks {
					t.Logf("分块 %d: %d-%d", i, chunk.Start, chunk.End)
				}
			} else {
				t.Logf("%s: 正确生成了 %d 个分块", tt.description, len(chunks))
			}
		})
	}
}
