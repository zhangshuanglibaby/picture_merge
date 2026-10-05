// 引入异常过滤器所需的装饰器和请求上下文类型。
import { Catch, type ArgumentsHost } from '@nestjs/common';

// 引入 Nest 默认过滤器：其他异常继续沿用原有处理方式。
import { BaseExceptionFilter } from '@nestjs/core';

// 只引入 Express 响应的类型，用来判断连接是否已关闭。
import type { Response } from 'express';


// 只接收 DOMException；不会接管普通业务错误。
@Catch(DOMException)
export class DisconnectedWaitFilter extends BaseExceptionFilter {
  catch(exception: DOMException, host: ArgumentsHost): void {
    // 取得当前 HTTP 响应，检查客户端连接状态。
    const response = host.switchToHttp().getResponse<Response>();

    // 仅忽略“客户端已断开”时，限流器产生的排队取消异常。
    // 此时无法再向客户端发送响应，但工作区仍由外层拦截器清理。
    // 排队取消和运行中取消都属于客户端已断开后的预期取消。
    const isExpectedCancellation =
      exception.name === 'AbortError' &&
      (
        exception.message === '等待任务已取消' ||
        exception.message === '正在运行的任务已取消'
      );

    if (response.destroyed && isExpectedCancellation) {
      return;
    }
    // 其他 DOMException 交还 Nest 原有逻辑，不能一概吞掉。
    super.catch(exception, host);
  }
}