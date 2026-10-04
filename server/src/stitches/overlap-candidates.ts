/**
 * 给多个候选位置分别计算分数、再比较分数，是常见的图像匹配思路。分数最低只表示“当前比较方法下最像”，不保证一定是真实重叠
 */

// 创建候选排序函数

// 引入灰度图类型；这个文件不负责读取或转换图片。
import type { GrayImage } from './load-gray-image.js';
// 引入上一步的函数：计算某一个候选重叠高度的分数。
import { calculateOverlapScore } from './overlap-score.js';
// 根据两张图的高度，生成最多 256 个粗筛重叠行数。
import { createOverlapRowsToTry } from './overlap-rows.js';

// 一条候选结果同时记录“重叠多少行”和“相似程度”。
export type OverlapCandidate = {
  overlapRows: number;
  score: number;
};

/**
 * 
 * @param first 第一张图片
 * @param second 第二张图片
 * @param overlapRowsToTry 尝试的重叠行数列表
 * @returns 候选结果列表
 */
export function rankOverlapCandidates(
  first: GrayImage,
  second: GrayImage,
  overlapRowsToTry: readonly number[],
): OverlapCandidate[] {
  // 没有候选高度时无法比较；明确报错便于发现调用错误。
  if (overlapRowsToTry.length === 0) {
    throw new Error('至少需要一个候选重叠行数');
  }

  // 逐个尝试调用者给出的高度，例如 1、2、3 行。 new Set(...) 是把重复的候选行数去掉：传入 [1, 2, 2, 3] 时，不必重复计算两次“重叠 2 行”
  const candidates = [...new Set(overlapRowsToTry)].map((overlapRows) => ({
    overlapRows,
    score: calculateOverlapScore(first, second, overlapRows),
  }));

  // 差值越小越相似；分数相同时按行数排序，保证结果稳定。
  candidates.sort(
    (a, b) => a.score - b.score || a.overlapRows - b.overlapRows,
  );

  // 返回所有结果，不在这里擅自决定裁切位置。
  return candidates;
}


// 先粗筛，再检查较好候选附近的每一个整数行数。
// 返回排名供后续判断；这里不宣称第一名一定正确。
/**
 * 
 * @param first 第一张图片
 * @param second 第二张图片
 * @returns 最佳重叠行数
 */
export function findOverlapCandidates(
  first: GrayImage,
  second: GrayImage,
): OverlapCandidate[] {
  // 先粗筛，再检查较好候选附近的每一个整数行数。
  const coarseRows = createOverlapRowsToTry(first.height, second.height);
  // 粗筛结果
  const coarseResults = rankOverlapCandidates(first, second, coarseRows);

  // 小图片的所有行数已经试过，不必重复计算。
  const maxRows = Math.min(first.height, second.height);
  if (maxRows <= 256) {
    return coarseResults;
  }

  // 大图片粗筛时相邻候选可能隔了若干行。
  const radius = Math.ceil(maxRows / 256);
  const fineRows = new Set<number>(); // 记录已经检查过的行数，避免重复计算。

  // 在前 5 名附近各查看这个距离内的整数行数。
  for (const candidate of coarseResults.slice(0, 5)) {
    for (
      let row = candidate.overlapRows - radius; // 从候选行数往左看。
      row <= candidate.overlapRows + radius; // 到候选行数往右看。
      row += 1 // 每次看一行。
    ) {
      // 只保留两张图片实际允许的重叠高度。
      if (row >= 1 && row <= maxRows) {
        fineRows.add(row);
      }
    }
  }

  // 对精查行数重新打分和排序，依然返回所有候选。
  return rankOverlapCandidates(first, second, [...fineRows]);
}





/**
 * 加一个“守门员”：分数不够好、重叠太短、或第一名与第二名太接近，就不决定裁切位置
 */

// 以下数值是第一版的保守门槛，之后须用真实截图校准。
const MIN_OVERLAP_ROWS = 40; // 最小重叠行数
const MAX_ACCEPTABLE_SCORE = 8; // 最大可接受分数
const MIN_SCORE_GAP = 3; // 最小分数差距

// 返回重叠行数；无法明确判断时返回 null，不让后续步骤盲目裁切。
/**
 * 
 * @param candidates 候选结果列表
 * @returns 重叠行数或 null
 */
export function chooseOverlapOrNull(
  candidates: readonly OverlapCandidate[],
): number | null {
  // 至少需要两个候选，才能判断第一名有没有明显胜过第二名。
  if (candidates.length < 2) {
    return null;
  }

  // 复制后排序，不修改调用者传入的原数组。
  const sorted = [...candidates].sort((a, b) => a.score - b.score);
  const best = sorted[0];
  const second = sorted[1];

  // 极短的“重叠”证据不足，暂时不自动使用。
  if (best.overlapRows < MIN_OVERLAP_ROWS) {
    return null;
  }

  // 最好的结果本身也不能差得太多。
  if (!Number.isFinite(best.score) || best.score > MAX_ACCEPTABLE_SCORE) {
    return null;
  }

  // 前两名得分相近，例如大片白底都得到 0 分，属于位置不明确。
  if (
    !Number.isFinite(second.score) ||
    second.score - best.score < MIN_SCORE_GAP
  ) {
    return null;
  }

  return best.overlapRows;
}