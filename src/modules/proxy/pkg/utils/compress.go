package utils

import (
	"bytes"
	"compress/gzip"
	"errors"
	"io"
	"strings"
)

var (
	ErrUnknownEncoding = errors.New("unknown content-encoding")
)

// Decode 按 Content-Encoding 解压；返回明文、规范化后的编码名（小写；若无编码则空串）
func Decode(body []byte, contentEncoding string) (plain []byte, normalizedEnc string, _ error) {
	enc := strings.ToLower(strings.TrimSpace(contentEncoding))
	switch enc {
	case "", "identity":
		return body, "", nil
	case "gzip":
		gr, err := gzip.NewReader(bytes.NewReader(body))
		if err != nil {
			return nil, "gzip", err
		}
		defer gr.Close()
		plain, err = io.ReadAll(gr)
		return plain, "gzip", err
	default:
		return nil, enc, ErrUnknownEncoding
	}
}

// Encode 按 normalizedEnc 回压缩（normalizedEnc 取自 Decode 的第二返回值）
func Encode(plain []byte, normalizedEnc string) ([]byte, error) {
	switch normalizedEnc {
	case "", "identity":
		return plain, nil
	case "gzip":
		var buf bytes.Buffer
		gw, err := gzip.NewWriterLevel(&buf, gzip.BestSpeed) // 或 BestCompression/DefaultCompression
		if err != nil {
			return nil, err
		}
		if _, err = gw.Write(plain); err != nil {
			_ = gw.Close()
			return nil, err
		}
		if err = gw.Close(); err != nil {
			return nil, err
		}
		return buf.Bytes(), nil
	default:
		// 不认识的编码：返回明文，不强行压缩
		return plain, ErrUnknownEncoding
	}
}
