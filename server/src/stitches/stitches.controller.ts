// 引入 NestJS 的路由、上传参数和 HTTP 异常工具。
import {
  Controller,
  HttpException,
  HttpStatus,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';

// 引入处理多个上传文件的拦截器。
import { FilesInterceptor } from '@nestjs/platform-express';
// 引入已有的图片数量限制。
import { IMAGE_LIMITS } from '../config/image-limits.js';
// 引入已有的图片校验服务。
import { StitchesService } from './stitches.service.js';
// 引入上一步创建的磁盘上传配置。
import { stitchUploadOptions } from './stitch-upload.options.js';
// 引入已有的临时目录拦截器。
import { UploadWorkspaceInterceptor } from './upload-workspace.interceptor.js';


// 控制器前缀是 images，下面的方法路径是 stitch。
@Controller('images')
export class StitchesController {

  // 注入图片校验服务。
  constructor(private readonly stitchesService: StitchesService) { }

  /**
   * 拼接多张图片，并返回拼接后的图片 URL。
   * 
   * @param files - 上传的图片文件。
   * @returns 拼接后的图片 URL。
   */
  @Post('stitch')
  @UseInterceptors( // 顺序不要调换：请求进入时，工作目录拦截器要先于文件上传拦截器执行；返回或抛错时，外层拦截器才有机会清理目录
    // 先建立临时工作目录，供后面的文件上传使用。
    UploadWorkspaceInterceptor,
    // 只接收字段名为 images 的文件，并使用已有的上传限制。
    FilesInterceptor('images', IMAGE_LIMITS.maxImages, stitchUploadOptions),
  )
  async stitch(@UploadedFiles() files: Express.Multer.File[]): Promise<never> {
    // 只把校验服务需要的磁盘路径和文件大小传进去。
    // 这里会检查图片数量、总大小以及图片内容。
    await this.stitchesService.validateImages(
      files.map((file) => ({ path: file.path, size: file.size })),
    );

    // 拼接和 PNG 输出还没实现；明确报错，不能假装请求成功。
    throw new HttpException(
      { code: 'NOT_IMPLEMENTED', message: '图片拼接功能尚未实现' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}