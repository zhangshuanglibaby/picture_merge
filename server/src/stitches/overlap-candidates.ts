/**
 * 给多个候选位置分别计算分数、再比较分数，是常见的图像匹配思路。分数最低只表示“当前比较方法下最像”，不保证一定是真实重叠
 */

// 创建候选排序函数

// 引入灰度图类型；这个文件不负责读取或转换图片。
import type { GrayImage } from './load-gray-image.js';
// 引入上一步的函数：计算某一个候选重叠高度的分数。
import { calculateOverlapScore } from './overlap-score.js';

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