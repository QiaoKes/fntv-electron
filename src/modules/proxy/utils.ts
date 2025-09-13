// 顶部 import（新增）
import * as http from 'http'
import type { Socket } from 'net'
import { isTrusted } from '../cert_trust'
const { v5: uuidv5 } = require('uuid')
import { Transform, pipeline } from 'stream'
import express, { Express, Request, Response, NextFunction } from 'express'

// 固定命名空间：可用官方的 DNS，也可换成你自己团队固定的 UUID
const NAMESPACE = uuidv5.DNS // DNS namespace

export function stringToUUID(name: string): string {
    // 建议先做统一化，避免大小写/空格导致不同结果
    const normalized = (name ?? '').trim()
    return uuidv5(normalized, NAMESPACE)
}

// 类型守卫：判断是否为 ServerResponse（HTTP）
export function isServerResponse(
    res: http.ServerResponse<http.IncomingMessage> | Socket
): res is http.ServerResponse<http.IncomingMessage> {
    // ServerResponse 独有 writeHead / statusCode 等
    return typeof (res as http.ServerResponse).writeHead === 'function'
}

/** 复制透传与视频相关的关键头（Range、Accept、Origin 等） */
export function passthroughHeaders(req: Request): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') out[k] = v
    }
    return out
}

export const DEFAULT_PART_SIZE = 10 * 1024 * 1024 // 10 MiB

// ===== 新增：工具函数 =====
type ByteRange = { start: number, end?: number } // [start, end] 闭区间；end 可缺失

// 解析 Range 头，返回字节范围
export function parseRangeHeader(rangeHeader?: string | string[]): ByteRange | null {
    if (!rangeHeader) return null
    const raw = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader
    const m = /^bytes=(\d+)-(\d+)?$/i.exec((raw || '').trim())
    if (!m) return null
    const start = Number(m[1])
    const end = m[2] != null ? Number(m[2]) : undefined
    if (!Number.isFinite(start) || start < 0) return null
    if (end != null && (!Number.isFinite(end) || end < start)) return null
    return { start, end }
}

// 将请求的字节范围对齐到上游分片边界
export function alignRangeForUpstream(reqR: ByteRange, partSize: number): { alignedStart: number; alignedEnd: number } {
    const S = partSize || DEFAULT_PART_SIZE
    const aStart = Math.floor(reqR.start / S) * S
    const aEnd = reqR.end != null ? (Math.ceil((reqR.end + 1) / S) * S - 1) : (aStart + S - 1)
    return { alignedStart: aStart, alignedEnd: aEnd }
}

// 解析 Content-Range 头，获取总长度
export function parseContentRangeTotal(cr?: string): number | null {
    // e.g. "bytes 0-10485759/881156649"
    if (!cr) return null
    const m = /^bytes\s+\d+-\d+\/(\d+)$/.exec(cr)
    return m ? Number(m[1]) : null
}

// 丢弃前 skip 字节、最多透传 need 字节
export class ByteSliceTransform extends Transform {
    private skip: number
    private need: number | null
    private dropped = 0
    private sent = 0
    constructor(skip: number, need: number | null) {
        super()
        this.skip = Math.max(0, skip | 0)
        this.need = need != null ? Math.max(0, need | 0) : null
    }
    _transform(chunk: Buffer, _enc: BufferEncoding, cb: Function) {
        let buf = chunk
        // 丢弃前 skip
        if (this.dropped < this.skip) {
            const remainSkip = this.skip - this.dropped
            if (buf.length <= remainSkip) {
                this.dropped += buf.length
                return cb() // 全丢
            } else {
                buf = buf.subarray(remainSkip)
                this.dropped += remainSkip
            }
        }
        // 限制 need
        if (this.need != null) {
            const remainNeed = this.need - this.sent
            if (remainNeed <= 0) return cb()
            if (buf.length > remainNeed) {
                this.push(buf.subarray(0, remainNeed))
                this.sent += remainNeed
                return cb()
            }
            this.sent += buf.length
        }
        this.push(buf)
        cb()
    }
}
