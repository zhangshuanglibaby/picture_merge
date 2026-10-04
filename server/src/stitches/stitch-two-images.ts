/**
 * “两张已确认重叠位置的图片如何拼成 PNG”
 */

// 新建拼接函数

// 引入 Sharp，读取图片尺寸、裁切第二张并合成 PNG。
import sharp from 'sharp';
// 引入已有的输出尺寸上限，防止创建过大的成品图片。
import { IMAGE_LIMITS } from '../config/image-limits.js';

/**
 * 
 * @param firstPath 第一张图片路径
 * @param secondPath 第二张图片路径
 * @param overlapRows 重叠行数
 * @returns 拼接后的图片
 */
export async function stitchTwoImages(
  firstPath: string,
  secondPath: string,
  overlapRows: number,
): Promise<Buffer> {
  // 先读取两张图片的宽高，不立即创建输出画布。
  const [first, second] = await Promise.all([
    sharp(firstPath).metadata(),
    sharp(secondPath).metadata(),
  ]);

  // 检查两张图的尺寸是否符合要求。
  if (!first.width || !first.height || !second.width || !second.height) {
    throw new Error('无法读取图片尺寸');
  }
  if (first.width !== second.width) {
    throw new Error('两张图片宽度不一致');
  }

  // 检查重叠行数是否有效。
  if (
    !Number.isSafeInteger(overlapRows) ||
    overlapRows < 1 ||
    overlapRows > first.height ||
    overlapRows >= second.height
  ) {
    // 第二张至少要保留 1 行，才能实际接到第一张下面。
    throw new Error('重叠行数无效');
  }

  // 计算输出图片的高度。
  const outputHeight = first.height + second.height - overlapRows;
  // 检查输出图片是否超过尺寸限制。
  if (
    outputHeight > IMAGE_LIMITS.maxOutputHeight ||
    first.width * outputHeight > IMAGE_LIMITS.maxOutputPixels
  ) {
    // 在分配输出画布之前检查，避免创建超限图片。
    throw new Error('输出图片超过尺寸限制');
  }

  // 从第二张的第 overlapRows 行开始截取，丢掉重复的顶部区域。
  const remainingSecond = await sharp(secondPath)
    .extract({ // 裁切第二张图片。
      left: 0, // 从第二张图片的第 overlapRows 行开始截取。
      top: overlapRows, // 从第二张图片的第 overlapRows 行开始截取。
      width: second.width, // 截取第二张图片的宽度。
      height: second.height - overlapRows, // 截取第二张图片的高度。
    })
    .png()
    .toBuffer();


  // 创建白底画布：第一张放顶部，裁切后的第二张紧接其后。
  // 返回编码好的 PNG 字节；这一阶段暂不写入文件或发送 HTTP 响应。
  return sharp({
    create: { // 创建一个空白图片。
      width: first.width, // 输出图片的宽度与第一张相同。
      height: outputHeight, // 输出图片的高度由两张图的高度和重叠行数决定。
      channels: 3, // 使用 3 通道 RGB 颜色。
      background: '#ffffff', // 使用白色背景。
    },
  })
    .composite([ // 将第一张和裁切后的第二张图片合成在一起。
      { input: firstPath, left: 0, top: 0 }, // 第一张图片放在顶部。
      { input: remainingSecond, left: 0, top: first.height }, // 裁切后的第二张图片放在第一张下面。
    ])
    .png()
    .toBuffer();
}