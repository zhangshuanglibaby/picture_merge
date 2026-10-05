/**
 * 把五张图片按裁切计划排到同一张画布上
 */

// 引入 Sharp，读取尺寸、裁切图片并合成最终 PNG。
import sharp from 'sharp';
// 引入现有的图片数量、输入像素和输出尺寸限制。
import { IMAGE_LIMITS } from '../config/image-limits.js';
// 引入项目已有的业务异常类，用于返回明确的错误码和 HTTP 状态码。
import { StitchError } from './stitch.error.js';


/**
 * 检查已经编码完成的 PNG 是否超过成品文件大小上限。
 * 单独写成函数，方便不用生成巨型图片就能测试字节边界。
 */
/**
 * 
 * @param output 已经编码完成的 PNG
 * @returns 没有超限时原样返回 PNG，交给控制器响应。
 */
export function assertOutputByteLimit(output: Buffer): Buffer {
  // length 是编码后 PNG 的实际字节数；只有超过上限才拒绝。
  if (output.length > IMAGE_LIMITS.maxOutputBytes) {
    // 把“成品过大”作为明确的业务错误交给接口返回。
    throw new StitchError('OUTPUT_TOO_LARGE', '拼接结果超出处理范围');
  }

  // 未超限时直接返回原数据；不要在这里再次调用自己。
  return output;
}

/**
 * 按顺序拼接 2～5 张图片。
 * cropTopPx[i] 是第 i 张顶部要裁掉的行数；第一张必须是 0。
 */

/**
 * 
 * @param paths 图片路径数组
 * @param cropTopPx 每张图片顶部要裁掉的行数数组
 * @returns 拼接后的图片
 */
export async function renderStitch(
  paths: readonly string[],
  cropTopPx: readonly number[],
): Promise<Buffer> {
  // 每张图片都必须有一个对应的裁切数字。
  if (
    paths.length < IMAGE_LIMITS.minImages ||
    paths.length > IMAGE_LIMITS.maxImages ||
    paths.length !== cropTopPx.length
  ) {
    throw new Error('图片数量或裁切计划无效');
  }


  const sizes: Array<{ width: number; height: number }> = []; // 保存每张图片的尺寸。
  let outputWidth = 0; // 输出图片的宽度。
  let outputHeight = 0; // 输出图片的高度。

  // 第一轮只检查尺寸和总高度；通过后才开始创建图片内容。
  for (let index = 0; index < paths.length; index += 1) {
    // 检查每张图片的尺寸，限制输入像素。
    const metadata = await sharp(paths[index], {
      limitInputPixels: IMAGE_LIMITS.maxInputPixels,
    }).metadata();

    // 如果无法读取图片尺寸，抛出错误。
    if (!metadata.width || !metadata.height) {
      throw new Error('无法读取图片尺寸');
    }

    // 第一张图片的宽度作为输出宽度。
    if (index === 0) {
      outputWidth = metadata.width;
    } else if (metadata.width !== outputWidth) { // 其他图片的宽度必须与第一张相同。
      throw new Error('图片宽度不同，需要先统一宽度');
    }

    const crop = cropTopPx[index]; // 当前图片顶部要裁掉的行数。

    // 必须留下至少一行；第一张不允许裁切。
    if (
      !Number.isSafeInteger(crop) ||
      crop < 0 ||
      crop >= metadata.height ||
      (index === 0 && crop !== 0)
    ) {
      throw new Error('裁切计划中的行数无效');
    }
    // 记录当前图片的尺寸，扣除要裁掉的行数。
    sizes.push({ width: metadata.width, height: metadata.height - crop });
    // 累加总高度。
    outputHeight += metadata.height - crop;


    // 在分配最终画布之前检查尺寸上限。
    if (
      outputHeight > IMAGE_LIMITS.maxOutputHeight ||
      outputWidth * outputHeight > IMAGE_LIMITS.maxOutputPixels
    ) {
      // 图片还没开始合成；直接告诉调用方：成品超出了允许范围。
      throw new StitchError('OUTPUT_TOO_LARGE', '拼接结果超出处理范围');
    }
  }

  // 每个图层都记录图片内容，以及它在最终画布上的起始高度。
  const layers: Array<{ input: Buffer; left: number; top: number }> = [];
  let nextTop = 0; // 下一层图片的起始高度。

  // 逐层创建图片内容。
  for (let index = 0; index < paths.length; index += 1) {
    const crop = cropTopPx[index]; // 当前图片顶部要裁掉的行数。
    const size = sizes[index];  // 当前图片的尺寸。

    // 去掉这一张顶部重复的部分，并把透明区域铺成白色。
    const input = await sharp(paths[index], {
      limitInputPixels: IMAGE_LIMITS.maxInputPixels, // 限制输入像素。
    })
      .extract({
        left: 0, // 左上角坐标。
        top: crop, // 顶部要裁掉的行数。
        width: size.width, // 宽度。
        height: size.height, // 高度。
      })
      .flatten({ background: '#ffffff' }) // 把透明区域铺成白色。
      .png() // 转换为 PNG 格式。
      .toBuffer(); // 转换为 Buffer。

    // 记录这一层图片内容，以及它在最终画布上的起始高度。
    layers.push({ input, left: 0, top: nextTop });
    // 累加下一层图片的起始高度。
    nextTop += size.height;
  }

  /// 先完成图层合成和 PNG 编码，取得成品的二进制数据。
  const output = await sharp({
    create: {
      width: outputWidth, // 宽度。
      height: outputHeight, // 高度。
      channels: 3, // 颜色通道数。
      background: '#ffffff', // 背景颜色。
    },
  })
    .composite(layers) // 合成所有图层。
    .png() // 转换为 PNG 格式。
    .toBuffer(); // 转换为 Buffer。

  // Buffer.length 是成品 PNG 的实际字节数，不是图片的像素数量。
  // 超限时抛出已有的业务错误，让接口返回 422 和明确的错误码。
  // if (output.length > IMAGE_LIMITS.maxOutputBytes) {
  //   throw new StitchError('OUTPUT_TOO_LARGE', '拼接结果超出处理范围');
  // }
  // // 只有成品文件大小合规，才把完整 PNG 交给控制器返回。
  // return output;
  // 图片已合成并编码；调用上面的检查函数，合规后返回 PNG。
  return assertOutputByteLimit(output);
}