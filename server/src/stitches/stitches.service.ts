/**
 * 按顺序校验整组图片。顺序是：检查张数 → 检查每张及整组的字节数 → 调用上一小步的 validateImage()
 */

import { Injectable } from '@nestjs/common';
// 读取统一配置中的单张大小及整组大小限制。
import { IMAGE_LIMITS } from '../config/image-limits.js';
// 调用上一小步完成的真实格式、尺寸和解码校验。
import { validateImage } from './image-validation.js';
// 沿用已有的 StitchError 导入，用它返回约定的业务错误。
import { StitchError } from './stitch.error.js';


// 这里是将来上传组件交给服务的最少信息。
// path 是服务器上的临时文件路径；size 是上传组件记录的字节数。
type UploadedImage = { path: string; size: number };

// @Injectable() 让 NestJS 能创建并管理这个服务。
@Injectable()
export class StitchesService {
  /**
   * 验证图片数量是否符合要求。
   * 
   * @param count - 图片数量。
   * @returns 如果数量符合要求，返回 true；否则抛出业务错误。
   */
  validateImageCount(count: number): void {
    const valid =
      Number.isInteger(count) &&
      count >= IMAGE_LIMITS.minImages &&
      count <= IMAGE_LIMITS.maxImages;

    // 数量不合要求时，使用上一小步定义的统一业务错误。
    if (!valid) {
      throw new StitchError('INVALID_COUNT', '请选择 2～5 张图片');
    }
  }

  /**
   * 验证一组图片文件。
   * 
   * @param files - 一组图片文件的信息。
   * @returns 如果所有图片都有效，返回它们的格式和尺寸；否则抛出业务错误。
   */
  async validateImages(files: readonly UploadedImage[]) {
    // 沿用已测试过的 2～5 张规则。
    this.validateImageCount(files.length);


    // 累计所有图片文件的大小。(图片文件字节数)
    let totalBytes = 0;

    // 保存每张图的路径与校验结果，顺序与传入的 files 一致。
    const checked: Array<{
      path: string;
      metadata: Awaited<ReturnType<typeof validateImage>>;  // 表示“validateImage() 执行完成后返回的数据类型”
    }> = [];

    // 遍历每张图，逐一校验。
    for (const file of files) {
      // 拒绝异常的字节数，避免计算总量时得到错误结果。
      if (!Number.isSafeInteger(file.size) || file.size <= 0) {
        throw new StitchError('INVALID_IMAGE', '图片无法读取，请重新选择');
      }

      // 拒绝超过单张大小的图片，避免计算总量时得到错误结果。
      if (file.size > IMAGE_LIMITS.maxFileBytes) {
        throw new StitchError('IMAGE_TOO_LARGE', '单张图片过大');
      }

      totalBytes += file.size; // 累计到总量中。
      if (totalBytes > IMAGE_LIMITS.maxUploadBytes) {
        throw new StitchError('IMAGE_TOO_LARGE', '本次上传总大小超出限制');
      }

      // 用文件的实际内容检查格式和尺寸，不相信文件名。
      const metadata = await validateImage(file.path);
      checked.push({ path: file.path, metadata });
    }

    return checked;
  }
}