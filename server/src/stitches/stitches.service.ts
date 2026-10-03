import { Injectable } from '@nestjs/common';
import { IMAGE_LIMITS } from '../config/image-limits.js';
import { StitchError } from './stitch.error.js';

// @Injectable() 让 NestJS 能创建并管理这个服务。
@Injectable()
export class StitchesService {
  // 只检查数量；图片内容和大小留到后续上传步骤检查。
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
}