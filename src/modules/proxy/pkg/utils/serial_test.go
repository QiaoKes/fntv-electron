package utils

import (
	"testing"
)

// TestConcurrentLimit 验证并发限制设置
func TestConcurrentLimit(t *testing.T) {
	// 验证常量设置
	if MaxConcurrentChunks != 1 {
		t.Errorf("MaxConcurrentChunks 期望为 1，实际为 %d", MaxConcurrentChunks)
	} else {
		t.Logf("✅ 并发限制设置正确: MaxConcurrentChunks = %d", MaxConcurrentChunks)
	}

	if PreloadChunks != 1 {
		t.Errorf("PreloadChunks 期望为 1，实际为 %d", PreloadChunks)
	} else {
		t.Logf("✅ 预加载设置正确: PreloadChunks = %d", PreloadChunks)
	}

	if ChunkSize != 10*1024*1024 {
		t.Errorf("ChunkSize 期望为 10MB，实际为 %d", ChunkSize)
	} else {
		t.Logf("✅ 分块大小设置正确: ChunkSize = %d bytes", ChunkSize)
	}
}

// TestSerialConfiguration 验证串行配置
func TestSerialConfiguration(t *testing.T) {
	t.Logf("🔧 当前配置验证:")
	t.Logf("   - 最大并发分块数: %d (串行)", MaxConcurrentChunks)
	t.Logf("   - 预加载分块数: %d", PreloadChunks)
	t.Logf("   - 分块大小: %d MB", ChunkSize/(1024*1024))

	if MaxConcurrentChunks == 1 {
		t.Logf("✅ 配置适合网盘风控: 串行请求，降低被限流风险")
	} else {
		t.Errorf("❌ 配置不适合网盘风控: 并发数过高 %d", MaxConcurrentChunks)
	}
}
