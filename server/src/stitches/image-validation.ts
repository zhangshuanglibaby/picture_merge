/**
 * 图片基础校验器：检查文件是否存在、是否超出单张大小、实际格式是否为 JPEG／PNG／WebP，以及宽高是否超限。
 */


// Node.js 自带的异步文件模块；stat 用来读取文件大小。
import { stat } from 'node:fs/promises';

// Sharp 用来识别图片实际格式、读取尺寸，并尝试解码图片。
// Metadata 只是 Sharp 返回的图片信息的 TypeScript 类型。
import sharp, { type Metadata } from 'sharp';

// 使用前面集中定义的图片大小、像素等限制。
import { IMAGE_LIMITS } from '../config/image-limits.js';

// 使用前面定义的统一业务错误，方便以后返回给前端。
import { StitchError } from './stitch.error.js';

/**
 * 验证图片文件是否有效。
 * 
 * @param filePath - 图片文件的完整路径。
 * @returns 如果图片有效，返回其信息；否则抛出业务错误。
 */
export async function validateImage(filePath: string) {
  let size: number; // 图片文件大小。

  try {
    // 先检查文件是否存在，并读取它实际占用的字节数。
    const file = await stat(filePath); // 获取文件信息。
    if (!file.isFile()) throw new Error('不是文件'); // 检查是否为文件。
    size = file.size; // 保存文件大小。
  } catch {
    throw new StitchError('INVALID_IMAGE', '图片无法读取，请重新选择');
  }

  // 如果文件大小为 0，说明它是一个空文件，无法作为图片使用。 
  if (size === 0) {
    throw new StitchError('INVALID_IMAGE', '图片无法读取，请重新选择');
  }

  // 如果文件大小超过最大限制，说明它太大，无法作为图片使用。
  if (size > IMAGE_LIMITS.maxFileBytes) {
    throw new StitchError('IMAGE_TOO_LARGE', '图片文件过大');
  }

  let metadata: Metadata; // 图片的元数据信息。
  try {
    // 此处只读图片信息，暂不解码全部像素；尺寸由下方亲自检查。 limitInputPixels 为 false 表示不限制输入像素。
    metadata = await sharp(filePath, { limitInputPixels: false }).metadata();
  } catch {
    throw new StitchError('INVALID_IMAGE', '图片无法读取，请重新选择');
  }

  // 解构出图片的格式、宽度、高度和页数。
  const { format, width, height, pages } = metadata;

  // 不相信文件后缀或浏览器提供的 MIME 类型，以图片实际格式为准。
  // 暂不接收动图；后续避免把多帧误当成单张截图。
  if (
    (format !== 'jpeg' && format !== 'png' && format !== 'webp') ||
    !width ||
    !height ||
    (pages ?? 1) > 1
  ) {
    throw new StitchError('INVALID_IMAGE', '图片格式不支持或无法读取');
  }

  // 检查图片尺寸是否超出限制。
  if (
    Math.max(width, height) > IMAGE_LIMITS.maxInputSide ||
    width * height > IMAGE_LIMITS.maxInputPixels
  ) {
    throw new StitchError('OUTPUT_TOO_LARGE', '图片尺寸超出处理范围');
  }

  try {
    // 触发一次实际解码，同时限制输入像素；缩到 1 像素仅用于校验，
    // 不会覆盖原图，将来拼接仍使用原图。
    await sharp(filePath, {
      limitInputPixels: IMAGE_LIMITS.maxInputPixels,
      failOn: 'error', // 如果解码失败，抛出错误。
    })
      .resize(1, 1) // 缩到 1 像素仅用于校验，不会覆盖原图，将来拼接仍使用原图。
      .toBuffer(); // 将图片转换为二进制缓冲区。
  } catch {
    throw new StitchError('INVALID_IMAGE', '图片无法读取，请重新选择');
  }

  // 把已经验证过的实际格式和尺寸交给后续处理步骤。
  return { format, width, height };
}