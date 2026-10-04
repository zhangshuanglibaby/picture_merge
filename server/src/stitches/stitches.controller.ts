// 引入 NestJS 的控制器、请求参数、响应头和拦截器装饰器。
import {
  Controller, // 控制器装饰器，用来定义控制器类。
  Header, // 响应头装饰器，用来设置 HTTP 响应头。
  Post, // 路由装饰器，用来定义 POST 请求的路径。
  Req, // 请求参数装饰器，用来读取 HTTP 请求对象。
  UploadedFiles, // 上传文件装饰器，用来读取上传的文件。  
  UseInterceptors, // 拦截器装饰器，用来定义拦截器。
  HttpCode, // 状态码装饰器，用来指定接口成功时返回的 HTTP 状态码。
  HttpStatus, // HTTP 状态码枚举，包含所有 HTTP 状态码。
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


// 控制器前缀是 images，下面的方法路径是 stitch。
@Controller('images')
export class StitchesController {
  // 注入图片校验服务。
  constructor(
    private readonly stitchesService: StitchesService,
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
  // 告诉浏览器：接口返回的是 PNG 图片。
  @Header('Content-Type', 'image/png')
  // 让浏览器可以直接预览生成的图片。
  @Header(
    'Content-Disposition',
    'inline; filename="stitched.png"',
  )
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
  ): Promise<Buffer> {
    // 先执行数量、文件大小、真实图片格式和图片尺寸校验。
    const checked = await this.stitchesService.validateImages(
      files.map((file) => ({
        // 传入服务器临时目录中的真实文件路径。
        path: file.path,

        // 传入 Multer 记录的文件字节数。
        size: file.size,
      })),
    );

    // 如果临时目录没有成功创建，无法继续处理图片。
    if (!request.uploadWorkspace) {
      throw new StitchError(
        'PROCESSING_FAILED',
        '无法创建图片处理临时目录',
      );
    }

    try {
      // 只传入校验成功后的图片路径。
      const result = await stitchImages(
        checked.map((image) => image.path),
        request.uploadWorkspace.directory,
      );

      // 直接把 PNG 二进制数据作为 HTTP 响应返回。
      return result.png;
    } catch {
      // 将图像处理阶段的普通错误转换成统一业务错误。
      throw new StitchError(
        'PROCESSING_FAILED',
        '图片拼接失败，请稍后重试',
      );
    }
  }
}