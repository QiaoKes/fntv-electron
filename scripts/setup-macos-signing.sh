#!/bin/bash

echo "🚀 开始生成自签名证书 (用于 Electron 打包测试)..."

CERT_NAME="electron-dev-cert"
KEY_FILE="$CERT_NAME.key"
CERT_FILE="$CERT_NAME.cer"
P12_FILE="$CERT_NAME.p12"
P12_PASSWORD="fntv123456"
VALID_DAYS=36500   # 100 年

echo "🔧 生成新的自签名证书 (会覆盖已有文件)..."

# 删除旧文件（如果存在）
rm -f "$KEY_FILE" "$CERT_FILE" "$P12_FILE"

# 生成私钥和自签名证书
openssl req -new -newkey rsa:2048 -x509 -days $VALID_DAYS -nodes \
    -subj "/CN=$CERT_NAME" \
    -keyout "$KEY_FILE" -out "$CERT_FILE"

# 转换为 p12 格式 (兼容 macOS Keychain)
openssl pkcs12 -export \
    -inkey "$KEY_FILE" \
    -in "$CERT_FILE" \
    -out "$P12_FILE" \
    -passout pass:"$P12_PASSWORD" \
    -macalg sha1 \
    -certpbe PBE-SHA1-3DES \
    -keypbe PBE-SHA1-3DES

echo "✅ 证书生成完成: $P12_FILE (有效期: $VALID_DAYS 天 ≈ 100 年)"

echo ""
echo "👉 导入证书到 macOS Keychain："
echo "security import $P12_FILE -k ~/Library/Keychains/login.keychain-db -P \"$P12_PASSWORD\" -T /usr/bin/codesign -A"
echo ""
echo "👉 然后在 electron-builder 配置里引用 $P12_FILE 来签名"
