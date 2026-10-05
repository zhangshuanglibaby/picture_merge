// 引入 NestJS 的控制器、请求参数、响应头和拦截器装饰器。
import {
  Controller, // 控制器装饰器，用来定义控制器类。
  Post, // 路由装饰器，用来定义 POST 请求的路径。
  Req, // 请求参数装饰器，用来读取 HTTP 请求对象。
  UploadedFiles, // 上传文件装饰器，用来读取上传的文件。  
  UseInterceptors, // 拦截器装饰器，用来定义拦截器。
  HttpCode, // 状态码装饰器，用来指定接口成功时返回的 HTTP 状态码。
  HttpStatus, // HTTP 状态码枚举，包含所有 HTTP 状态码。
  StreamableFile, // NestJS 专门用于返回图片、PDF 等二进制文件的类型。
} from '@nestjs/common';

// 引入处理多个上传文件的 Multer 拦截器。
import { FilesInterceptor } from '@nestjs/platform-express';
// 引入图片数量限制，确保接口最多接收 5 张图片。
import { IMAGE_LIMITS } from '../config/image-limits.js';
// 引入完整的自动拼接流程。
import { stitchImages } from './stitch-images.js';
// 引入统一的业务错误类型。
import { StitchError } from './stitch.error.js';
// 引入已有的图片校验服务。
import { StitchesService } from './stitches.service.js';
// 引入上传配置，限制文件大小和保存方式。
import { stitchUploadOptions } from './stitch-upload.options.js';
// 引入临时目录拦截器，确保请求结束后删除上传文件。
import {
  UploadWorkspaceInterceptor,
  type UploadRequest,
} from './upload-workspace.interceptor.js';
// 引入共享的任务限流器，控制同时进行的图片处理数量。
import { StitchTaskLimiter } from './stitch-task-limiter.js';


// 控制器前缀是 images，下面的方法路径是 stitch。
@Controller('images')
export class StitchesController {
  // 负责校验上传图片。
  constructor(
    private readonly stitchesService: StitchesService,

    // 负责分配和归还拼接任务的工作位置。
    private readonly stitchTaskLimiter: StitchTaskLimiter,
  ) { }

  /**
   * 接收 2～5 张图片，自动识别重叠区域并返回 PNG。
   *
   * @param request 当前 HTTP 请求，里面保存了临时工作目录。
   * @param files Multer 保存到磁盘后的图片文件。
   * @returns 拼接后的 PNG 二进制数据。
   */

  @Post('stitch')
  // POST 请求成功时固定返回 200。
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    // 先创建临时工作目录。
    UploadWorkspaceInterceptor,

    // 再把上传的图片保存到这个临时工作目录。
    FilesInterceptor(
      'images',
      IMAGE_LIMITS.maxImages,
      stitchUploadOptions,
    ),
  )
  async stitch(
    // 读取当前请求对象，从中取得临时目录。
    @Req() request: UploadRequest,

    // 读取字段名为 images 的所有上传文件。
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<StreamableFile> {
    {
      // 如果临时目录没有创建成功，就不能继续使用上传文件。
      if (!request.uploadWorkspace) {
        throw new StitchError(
          'PROCESSING_FAILED',
          '无法创建图片处理临时目录',
        );
      }

      // 尝试取得一个工作位置；已满时得到 null。
      const release = this.stitchTaskLimiter.tryAcquire();

      // 没有位置就立即返回 503，错误码为 BUSY。
      if (release === null) {
        throw new StitchError('BUSY', '当前处理任务较多，请稍后重试');
      }

      try {
        // 从这里开始，图片校验和拼接都占用同一个工作位置。
        const checked = await this.stitchesService.validateImages(
          files.map((file) => ({
            // Multer 保存图片后的临时文件路径。
            path: file.path,

            // Multer 记录的文件大小，单位是字节。
            size: file.size,
          })),
        );

        // 按上传顺序处理已经校验通过的图片。
        const result = await stitchImages(
          checked.map((image) => image.path),
          request.uploadWorkspace.directory,
        );

        // 将完成的 PNG 作为二进制图片返回。
        return new StreamableFile(result.png, {
          type: 'image/png',
          disposition: 'inline; filename="stitched.png"',
          length: result.png.length,
        });
      } catch (error) {
        // 已有的业务错误（例如图片无效、输出过大）保留原错误码。
        if (error instanceof StitchError) {
          throw error;
        }

        // 其他意外错误统一转换为处理失败。
        throw new StitchError(
          'PROCESSING_FAILED',
          '图片拼接失败，请稍后重试',
        );
      } finally {
        // 成功、校验失败或拼接失败，都会执行这里。
        // 归还的是“并发工作位置”，不是删除上传文件。
        release();
      }
    }
  }
}