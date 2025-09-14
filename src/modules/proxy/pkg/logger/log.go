package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"
)

// 日志级别
type LogLevel int

const (
	DEBUG LogLevel = iota
	INFO
	WARN
	ERROR
	FATAL
)

// 日志级别字符串映射
var levelStrings = map[LogLevel]string{
	DEBUG: "DEBUG",
	INFO:  "INFO",
	WARN:  "WARN",
	ERROR: "ERROR",
	FATAL: "FATAL",
}

// 日志级别颜色映射 (ANSI 颜色代码)
var levelColors = map[LogLevel]string{
	DEBUG: "\033[36m", // 青色
	INFO:  "\033[32m", // 绿色
	WARN:  "\033[33m", // 黄色
	ERROR: "\033[31m", // 红色
	FATAL: "\033[35m", // 紫色
}

const resetColor = "\033[0m"

// Logger 结构体
type Logger struct {
	minLevel   LogLevel
	logger     *log.Logger
	file       *os.File
	color      bool
	callerInfo bool
	mu         sync.Mutex
}

// 全局默认日志实例
var std = NewLogger(INFO, os.Stdout)

// 创建新日志实例
func NewLogger(level LogLevel, out io.Writer) *Logger {
	return &Logger{
		minLevel:   level,
		logger:     log.New(out, "", 0),
		color:      true,
		callerInfo: true,
	}
}

// 设置全局日志级别
func SetLevel(level LogLevel) {
	std.mu.Lock()
	defer std.mu.Unlock()
	std.minLevel = level
}

// 获取当前日志级别
func GetLevel() LogLevel {
	std.mu.Lock()
	defer std.mu.Unlock()
	return std.minLevel
}

// 启用/禁用颜色输出
func SetColor(enabled bool) {
	std.mu.Lock()
	defer std.mu.Unlock()
	std.color = enabled
}

// 启用/禁用调用者信息
func SetCallerInfo(enabled bool) {
	std.mu.Lock()
	defer std.mu.Unlock()
	std.callerInfo = enabled
}

// 设置日志输出文件
func SetLogFile(filename string) error {
	std.mu.Lock()
	defer std.mu.Unlock()

	// 关闭旧文件
	if std.file != nil {
		std.file.Close()
	}

	// 创建目录
	dir := filepath.Dir(filename)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	// 打开文件
	file, err := os.OpenFile(filename, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return err
	}

	// 设置输出到文件和控制台
	std.logger.SetOutput(io.MultiWriter(os.Stdout, file))
	std.file = file
	return nil
}

// 关闭日志文件
func CloseLogFile() {
	std.mu.Lock()
	defer std.mu.Unlock()
	if std.file != nil {
		std.file.Close()
		std.file = nil
		std.logger.SetOutput(os.Stdout)
	}
}

// 获取调用者信息
func (l *Logger) getCallerInfo() string {
	if !l.callerInfo {
		return ""
	}

	_, file, line, ok := runtime.Caller(3) // 跳过3层调用栈
	if !ok {
		return ""
	}

	// 只保留文件名
	return fmt.Sprintf("%s:%d", filepath.Base(file), line)
}

// 日志输出核心方法
func (l *Logger) log(level LogLevel, format string, args ...interface{}) {
	if level < l.minLevel {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	// 构建日志前缀
	now := time.Now().Format("2006-01-02 15:04:05")
	levelStr := levelStrings[level]
	callerInfo := l.getCallerInfo()

	// 构建日志消息
	message := fmt.Sprintf(format, args...)

	// 添加颜色
	if l.color && (os.Getenv("TERM") != "dumb") {
		color := levelColors[level]
		if callerInfo != "" {
			l.logger.Printf("%s %s%-5s%s [%s] %s",
				now, color, levelStr, resetColor, callerInfo, message)
		} else {
			l.logger.Printf("%s %s%-5s%s %s",
				now, color, levelStr, resetColor, message)
		}
	} else {
		if callerInfo != "" {
			l.logger.Printf("%s %-5s [%s] %s",
				now, levelStr, callerInfo, message)
		} else {
			l.logger.Printf("%s %-5s %s",
				now, levelStr, message)
		}
	}

	// FATAL 级别退出程序
	if level == FATAL {
		os.Exit(1)
	}
}

// =============== 全局日志函数 ===============

func Debugf(format string, args ...interface{}) {
	std.log(DEBUG, format, args...)
}

func Infof(format string, args ...interface{}) {
	std.log(INFO, format, args...)
}

func Warnf(format string, args ...interface{}) {
	std.log(WARN, format, args...)
}

func Errorf(format string, args ...interface{}) {
	std.log(ERROR, format, args...)
}

func Fatalf(format string, args ...interface{}) {
	std.log(FATAL, format, args...)
}

// 简单日志函数 (无格式化)
func Debug(args ...interface{}) {
	std.log(DEBUG, "%s", fmt.Sprint(args...))
}

func Info(args ...interface{}) {
	std.log(INFO, "%s", fmt.Sprint(args...))
}

func Warn(args ...interface{}) {
	std.log(WARN, "%s", fmt.Sprint(args...))
}

func Error(args ...interface{}) {
	std.log(ERROR, "%s", fmt.Sprint(args...))
}

func Fatal(args ...interface{}) {
	std.log(FATAL, "%s", fmt.Sprint(args...))
}
