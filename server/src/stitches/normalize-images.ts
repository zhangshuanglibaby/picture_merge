/**
 * 处理不同宽度
 * 先把本次图片统一缩到其中最窄的宽度，再交给现有的识别与拼接函数；不放大较窄的图
 */

// 引入 Node.js 路径工具，把工作目录与输出文件名组合起来。
import { join } from 'node:path';
// 引入 Sharp，读取方向和尺寸，并生成统一宽度的 PNG。
import sharp from 'sharp';
// 引入现有的图片数量及输入像素限制。
import { IMAGE_LIMITS } from '../config/image-limits.js';


/**
 * 将 2～5 张图片调整方向、统一宽度，保存到本次请求的临时目录。
 * 返回新文件路径，顺序与原图片一致。
 */
/**
 * 
 * @param paths 图片路径数组
 * @param workspaceDirectory 工作目录
 * @returns 新文件路径数组
 */
export async function normalizeImages(
  paths: readonly string[],
  workspaceDirectory: string,
): Promise<string[]> {
  // 与上传接口的图片数量规则保持一致。
  if (
    paths.length < IMAGE_LIMITS.minImages ||
    paths.length > IMAGE_LIMITS.maxImages
  ) {
    throw new Error('需要 2～5 张图片');
  }

  // 先找出方向调整后最窄的宽度，避免把小图放大。
  let targetWidth = Number.POSITIVE_INFINITY;

  // 遍历所有图片，计算出方向调整后最窄的宽度。
  for (const path of paths) {

    // 读取图片方向和尺寸。
    const metadata = await sharp(path, {
      limitInputPixels: IMAGE_LIMITS.maxInputPixels,
    }).metadata();

    const width = metadata.autoOrient.width; // 获取图片宽度。
    if (!Number.isSafeInteger(width) || width < 1) {
      throw new Error('无法读取图片宽度');
    }

    // 更新最窄宽度。
    targetWidth = Math.min(targetWidth, width);
  }

  // 准备保存新图片的目录。
  const normalizedPaths: string[] = [];

  // 每张图片都写入独立的新文件，不覆盖用户上传的原文件。
  // 注意：图片索引与原数组一致，以便保持顺序。
  for (let index = 0; index < paths.length; index += 1) {
    // 生成新文件名，保持原扩展名。
    const outputPath = join(workspaceDirectory, `normalized-${index}.png`);

    // 调整方向并缩放宽度，写入新文件。
    await sharp(paths[index], {
      limitInputPixels: IMAGE_LIMITS.maxInputPixels,
    })
      .autoOrient() // 按 EXIF 信息摆正图片。
      .resize({ width: targetWidth, withoutEnlargement: true }) // 等比缩小。
      .flatten({ background: '#ffffff' }) // 透明部分铺成白色。
      .png() // 统一为 PNG，供后面的识别和合成使用。
      .toFile(outputPath); // 保存到本次请求的临时目录。

    normalizedPaths.push(outputPath); // 记录新文件路径。
  }

  return normalizedPaths; // 返回新文件路径数组。
}

