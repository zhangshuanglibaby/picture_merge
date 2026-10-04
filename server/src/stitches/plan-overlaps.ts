/**
 * “裁切计划”
 */

// 引入项目现有的图片数量限制，避免这个函数被错误地传入过多图片。
import { IMAGE_LIMITS } from '../config/image-limits.js';
// 引入现有函数，把图片文件读取成可比较的灰度像素。
import { loadGrayImage } from './load-gray-image.js';
// 引入现有的候选搜索与可靠性判断函数。
import {
  chooseExactOverlapOrNull,
  findOverlapCandidates,
} from './overlap-candidates.js';


/**
 * 按上传顺序，计算每张图片顶部可能需要裁掉的行数。
 * 第一张固定为 0；后续返回数字或 null（无法确认）。
 */
/**
 * 
 * @param paths 图片路径数组
 * @returns 每张图片顶部可能需要裁掉的行数数组
 */
export async function planOverlaps(
  paths: readonly string[],
): Promise<Array<number | null>> {
  // 与上传接口保持一致，只接受 2～5 张图片。
  if (
    paths.length < IMAGE_LIMITS.minImages ||
    paths.length > IMAGE_LIMITS.maxImages
  ) {
    throw new Error('需要 2～5 张图片');
  }

  // 第一张没有前一张可比较，因此不裁切。
  const results: Array<number | null> = [0];

  // previous 保存前一张原图的灰度数据。
  let previous = await loadGrayImage(paths[0]);

  // 从第二张开始，每次只与紧挨着的前一张原图比较。
  for (let index = 1; index < paths.length; index += 1) {
    const current = await loadGrayImage(paths[index]); // 当前图片的灰度数据。

    // 当前比较算法要求等宽；不同宽度将在后续归一化步骤处理。
    if (previous.width !== current.width) {
      throw new Error('图片宽度不同，需要先统一宽度');
    }

    const candidates = findOverlapCandidates(previous, current); // 找出可能的重叠位置。
    const rows = chooseExactOverlapOrNull(previous, current, candidates); // 选择最可靠的重叠位置。

    // null 原样保留，不在规划阶段擅自决定是否裁切。
    results.push(rows);

    // 下一轮要比较“当前原图”和“下一张原图”。
    previous = current;
  }
  return results;
}