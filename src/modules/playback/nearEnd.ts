/**
 * 「接近片尾」的唯一定义。
 *
 * 播放比例达到该比例即视为接近片尾，同时用于两处判断：
 * - 播放器恢复上次播放位置时，接近片尾则不跳转
 * - 播放项结束时，接近片尾则标记为已观看
 */
export const NEAR_END_RATIO = 0.98;

/**
 * 判断某个播放进度是否已接近片尾。
 *
 * `duration <= 0` 一律返回 `false`：某些播放源（直链类）拿不到可靠时长，
 * 此时宁可漏判也不误判。
 *
 * @param ts 当前播放位置（秒）
 * @param duration 播放项总时长（秒）
 */
export function isNearEnd(ts: number, duration: number): boolean {
    return duration > 0 && ts >= duration * NEAR_END_RATIO;
}
