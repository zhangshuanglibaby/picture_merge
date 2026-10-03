// Node.js 自带的文件模块；检查临时目录是否还存在。
import { existsSync } from 'node:fs';

// NestJS 的类型，用来模拟请求上下文和后续处理步骤。
import { type CallHandler, type ExecutionContext } from '@nestjs/common';


// RxJS：模拟成功、失败，并等待拦截器执行完毕。
import { defer, lastValueFrom, of, throwError } from 'rxjs';

// Vitest：组织测试、分别测试两种结果并检查断言。
import { describe, expect, it } from 'vitest';

// 导入被测试的拦截器和请求类型。
import {
  UploadWorkspaceInterceptor,
  type UploadRequest,
} from './upload-workspace.interceptor.js';


describe('UploadWorkspaceInterceptor', () => {
  it.each([false, true])('后续步骤失败=%s 时都清理目录', async (fail) => {
    const request: UploadRequest = {};

    // 模拟 NestJS 把当前 HTTP 请求交给拦截器。
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    let createdDirectory = '';
    const next: CallHandler = {
      handle: () =>
        defer(() => {
          // 后续步骤开始时，目录必须已经存在。
          const directory = request.uploadWorkspace?.directory;
          if (!directory) throw new Error('没有创建临时目录');
          createdDirectory = directory;
          expect(existsSync(directory)).toBe(true);

          return fail ? throwError(() => new Error('模拟失败')) : of('成功');
        }),
    };

    const result = lastValueFrom(
      new UploadWorkspaceInterceptor().intercept(context, next),
    );

    if (fail) await expect(result).rejects.toThrow('模拟失败');
    else await expect(result).resolves.toBe('成功');

    // 不论后续步骤成功还是失败，都不能留下目录。
    expect(existsSync(createdDirectory)).toBe(false);
  });
});