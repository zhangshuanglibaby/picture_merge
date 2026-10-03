/**
 * 把真实图片转换成灰度像素数组
 */

// 引入 Sharp，用它解码图片并取得原始像素。
import sharp from 'sharp';
// 引入已有的像素上限，限制本次图片解码的规模。
import { IMAGE_LIMITS } from '../config/image-limits.js';

// 描述转换完成后，交给重叠比较函数使用的数据。
export type GrayImage = {
  width: number;          // 一行有多少个像素。
  height: number;         // 图片共有多少行。
  pixels: Uint8Array;     // 从上到下、每行从左到右排列的灰度值。
};

/**
 * 把真实图片转换成灰度像素数组
 * @param filePath 图片文件路径
 * @returns 灰度像素数组
 */
export async function loadGrayImage(filePath: string): Promise<GrayImage> {
  // data 是像素数据，info 是图片信息。
  const { data, info } = await sharp(filePath, {
    // 即使之前做过上传校验，解码时仍保留像素数量限制。
    limitInputPixels: IMAGE_LIMITS.maxInputPixels,
  })
    // 如果有透明区域，先以白色作背景，避免透明像素干扰比较。
    .flatten({ background: '#ffffff' })
    // 明确要求输出为单通道黑白色彩空间。
    .toColourspace('b-w')
    // 取得未压缩的、每个通道占 1 字节的像素数据。
    .raw({ depth: 'uchar' })
    // 同时取得像素数据和实际输出的宽、高、通道数。
    .toBuffer({ resolveWithObject: true });

  // row-difference.ts 假设“一像素一字节”，这里必须确认假设成立。
  // channels 是通道数，1 表示单通道，8 表示 8 通道。
  if (info.channels !== 1 || data.length !== info.width * info.height) {
    throw new Error('图片未能转换成单通道灰度像素');
  }

  return {
    width: info.width, // 直接返回图片宽度。
    height: info.height, // 直接返回图片高度。
    pixels: data, // 直接返回像素数据，无需再做数据转换。
  };
}