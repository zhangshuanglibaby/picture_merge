/**
 * 临时目录管理拦截器
 */


// NestJS 的拦截器类型：获取请求，并控制何时执行后续处理。
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';

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
        // 等后续处理完成；如果它报错，错误会继续向外传递。
        const result: unknown = await lastValueFrom(next.handle());
        return result;
      } finally {
        // 成功和报错都会执行；等待文件真正删除后才结束本次处理。
        delete request.uploadWorkspace;
        await workspace.cleanup();
      }
    })
  }
}
