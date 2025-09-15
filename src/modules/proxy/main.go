package main

import (
	"proxy/internal/logic"
	"proxy/pkg/logger"
)

func main() {
	logger.SetLevel(logger.INFO)
	logger.SetColor(false)

	err := logic.RunApiServer("127.0.0.1:22345")
	if err != nil {
		panic("启动服务器失败: " + err.Error())
	}
}
