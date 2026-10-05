/**
 * 临时目录管理拦截器
 */


// NestJS 的拦截器类型：获取请求，并控制何时执行后续处理。
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  BadRequestException, // 用来识别上传组件返回的“请求有误”异常。
  PayloadTooLargeException, // 识别上传组件因单个文件超过大小限制而抛出的 413 异常。
} from '@nestjs/common';

// StitchError 是项目自己的错误类型，能给前端返回 code 和中文 message。
import { StitchError } from './stitch.error.js';

// RxJS 是 NestJS 使用的异步处理库。
// defer 在请求被执行时才开始工作；lastValueFrom 等待后续处理结束。
import { defer, lastValueFrom, type Observable } from 'rxjs';

// 导入上一小步写好的临时目录创建与清理函数。
import { createUploadWorkspace } from './upload-workspace.js';

// 记录“本次请求对应哪个临时目录”；以后磁盘上传会读取这个属性。
export type UploadRequest = {
  uploadWorkspace?: Awaited<ReturnType<typeof createUploadWorkspace>>;
};


@Injectable()
export class UploadWorkspaceInterceptor implements NestInterceptor {
  /**
   * 拦截请求，创建临时目录，并返回一个可观察对象，后续处理可以访问这个临时目录。
   * 
   * @param context - 请求上下文。
   * @param next - 后续处理。
   * @returns 一个可观察对象，后续处理可以访问这个临时目录；如果创建失败，返回业务错误。
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {

    // 从当前 HTTP 请求中取得可保存临时目录信息的对象。
    const request = context.switchToHttp().getRequest<UploadRequest>();

    // 创建一个可观察对象，在请求被执行时才开始工作。
    return defer(async () => {
      // 每次请求新建一个独立目录，并把它交给后续上传步骤使用。
      const workspace = await createUploadWorkspace();
      request.uploadWorkspace = workspace;

      try {
        // 等待上传和后续拼接处理完成；成功时原样返回结果。
        const result: unknown = await lastValueFrom(next.handle());
        return result;
      } catch (error: unknown) {
        // 第六张图片会先被上传组件拦住，无法进入服务中的数量校验。
        // 只把这一种明确的错误转换为项目约定的 INVALID_COUNT。
        if (
          error instanceof BadRequestException &&
          error.message === 'Too many files'
        ) {
          throw new StitchError('INVALID_COUNT', '请选择 2～5 张图片');
        }

        // 上传接口只接收名为 images 的文件字段。
        // 如果前端误传 photos 等字段，上传组件会在进入 Controller 前拒绝请求。
        // 把它转换为前端能够识别的业务错误，而不是直接返回英文提示。
        if (
          error instanceof BadRequestException &&
          error.message.startsWith('Unexpected file field - ')
        ) {
          throw new StitchError('INVALID_COUNT', '请使用 images 字段上传图片');
        }

        // 上传组件会先拦截过大的文件，此时图片校验逻辑还没有机会运行。
        // 只转换它明确给出的“单个文件过大”错误，保留其他异常的原有行为。
        if (
          error instanceof PayloadTooLargeException &&
          error.message === 'File too large'
        ) {
          // StitchError 会返回约定的 413 状态码、业务 code 和中文提示。
          throw new StitchError('IMAGE_TOO_LARGE', '单张图片过大');
        }

        // 其他错误与图片数量无关，保持原样继续抛出，避免掩盖真实问题。
        throw error;
      } finally {
        // 无论成功、数量超限或发生其他错误，都清理本次上传的临时目录。
        delete request.uploadWorkspace;
        await workspace.cleanup();
      }
    })
  }
}