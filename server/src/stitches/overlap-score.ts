/**
 * 重叠核心原理：拿第一张的“最后 N 行”，与第二张的“最前 N 行”逐行对齐比较
 * 给指定 N 打分”的函数
 */

// 引入灰度图的数据类型；这里只需要类型，不会再次读取图片。
import type { GrayImage } from './load-gray-image.js';

// 引入上一阶段完成的“比较两行”函数。
import { calculateRowDifference } from './row-difference.js';

// overlapRows 表示“假设两张图重叠了多少行”。
// 返回值是抽样行的平均差值：越小，代表这个假设越吻合。

/** 
 * 给指定 N 打分
 * @param first 第一张图片
 * @param second 第二张图片
 * @param overlapRows 假设两张图重叠了多少行
 * @returns 抽样行的平均差值：越小，代表这个假设越吻合。
 */
export function calculateOverlapScore(
  first: GrayImage,
  second: GrayImage,
  overlapRows: number,
): number {
  // 两张图每行的像素数必须相同，才能逐列对齐。
  if (first.width !== second.width) {
    throw new Error('两张图片的宽度必须相同');
  }

  // 重叠行数不能是小数、0，也不能超过任意一张图的高度。
  if (
    !Number.isSafeInteger(overlapRows) ||
    overlapRows < 1 ||
    overlapRows > Math.min(first.height, second.height)
  ) {
    throw new Error('候选重叠行数无效');
  }

  // 最多均匀选取 16 行，避免大图在尝试每种重叠高度时过慢。
  // 如果候选区域不足 16 行，就逐行比较。
  const sampleCount = Math.min(overlapRows, 16);
  // 记录所有抽样行的总差异。
  let totalDifference = 0;

  // 遍历抽样行。
  for (let sample = 0; sample < sampleCount; sample += 1) {
    // 在候选重叠区域内均匀选位置，包含开头和结尾。
    const offset = sampleCount === 1
      ? 0
      : Math.floor((sample * (overlapRows - 1)) / (sampleCount - 1));

    // 第一张从“倒数 overlapRows 行”开始取。
    const firstRow = first.height - overlapRows + offset;
    // 第二张从最顶部开始取同样的位置。
    const secondRow = offset;

    // 计算两行的像素差值，并累加到总差异中。
    totalDifference += calculateRowDifference(
      first.pixels,
      second.pixels,
      first.width,
      firstRow,
      secondRow
    );
  }

  // 将所有抽样行的差值求平均，作为这个候选重叠高度的分数。
  return totalDifference / sampleCount;
}