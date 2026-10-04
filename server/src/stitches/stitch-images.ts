/**
 * “自动计算裁切计划”和“生成 PNG”接起来
 */

// 引入现有的裁切计划函数，按顺序识别相邻图片的重叠。
import { planOverlaps } from './plan-overlaps.js';
// 引入现有的多图合成函数，按照数字行数生成 PNG。
import { renderStitch } from './render-stitch.js';

// 引入图片预处理函数：统一图片方向、宽度，并处理透明区域。
import { normalizeImages } from './normalize-images.js';

// png 是最终图片；unconfirmedImageIndices 使用从 0 开始的图片下标。
export type StitchResult = {
  png: Buffer;
  cropTopPx: number[]; // 每张图片顶部要裁掉的行数数组。
  unconfirmedImageIndices: number[]; // 使用从 0 开始的图片下标。
};


/**
 * 自动预处理、识别重叠并拼接 2～5 张图片。
 *
 * @param paths 原始图片路径数组。
 * @param workspaceDirectory 本次请求专用的临时工作目录。
 * @returns 拼接后的 PNG、裁切计划和无法确认的位置。
 */
export async function stitchImages(
  paths: readonly string[],
  workspaceDirectory: string,
): Promise<StitchResult> {

  // 先统一方向、宽度和透明背景。
  // 后面的重叠识别和图片拼接都使用处理后的图片。
  const normalizedPaths = await normalizeImages(
    paths,
    workspaceDirectory,
  );

  // 例如五张样例会得到 [0, 80, null, 70, null]。
  // 使用统一尺寸后的图片识别相邻图片的重叠行数。
  const planned = await planOverlaps(normalizedPaths);
  const unconfirmedImageIndices: number[] = []; // 无法确认的图片下标。

  // 合成函数只接受数字；无法确认的位置暂时不裁切，但记录下来。
  const cropTopPx = planned.map((rows, index) => {
    if (rows === null) {
      unconfirmedImageIndices.push(index); // 记录无法确认的图片下标。
      return 0;
    }
    return rows; // 返回裁切计划中的行数。
  });

  // 使用预处理后的图片生成最终 PNG。
  const png = await renderStitch(normalizedPaths, cropTopPx);

  return { png, cropTopPx, unconfirmedImageIndices }; // 返回拼接结果。
}