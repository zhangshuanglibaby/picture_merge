/**
 * “自动计算裁切计划”和“生成 PNG”接起来
 */

// 引入现有的裁切计划函数，按顺序识别相邻图片的重叠。
import { planOverlaps } from './plan-overlaps.js';
// 引入现有的多图合成函数，按照数字行数生成 PNG。
import { renderStitch } from './render-stitch.js';

// png 是最终图片；unconfirmedImageIndices 使用从 0 开始的图片下标。
export type StitchResult = {
  png: Buffer;
  cropTopPx: number[]; // 每张图片顶部要裁掉的行数数组。
  unconfirmedImageIndices: number[]; // 使用从 0 开始的图片下标。
};


/** 自动规划并拼接 2～5 张等宽图片。 */
/**
 * 
 * @param paths 图片路径数组
 * @returns 拼接结果
 */
export async function stitchImages(
  paths: readonly string[],
): Promise<StitchResult> {
  // 例如五张样例会得到 [0, 80, null, 70, null]。
  const planned = await planOverlaps(paths); // 裁切计划。
  const unconfirmedImageIndices: number[] = []; // 无法确认的图片下标。

  // 合成函数只接受数字；无法确认的位置暂时不裁切，但记录下来。
  const cropTopPx = planned.map((rows, index) => {
    if (rows === null) {
      unconfirmedImageIndices.push(index); // 记录无法确认的图片下标。
      return 0;
    }
    return rows; // 返回裁切计划中的行数。
  });

  // 用最终数字计划生成一张 PNG。
  const png = await renderStitch(paths, cropTopPx);

  return { png, cropTopPx, unconfirmedImageIndices }; // 返回拼接结果。
}