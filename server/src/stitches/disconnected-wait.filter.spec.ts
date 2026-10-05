/**
 * 新增过滤器单元测试
 */


// 引入 NestJS 的 HTTP 上下文类型，只用于描述测试替身的类型。
import type { ArgumentsHost } from '@nestjs/common';

// 引入 Nest 默认异常过滤器，用来确认异常确实被继续交给父类处理。
import { BaseExceptionFilter } from '@nestjs/core';

// 引入 Express 响应类型，只用于描述测试中的响应对象。
import type { Response } from 'express';

// 引入 Vitest 的测试分组、断言、测试用例和模拟函数。
import { describe, expect, it, vi } from 'vitest';

// 引入当前项目的异常过滤器。
import { DisconnectedWaitFilter } from './disconnected-wait.filter.js';

describe('DisconnectedWaitFilter', () => {
  it('连接未断开时，不会吞掉同名 AbortError', () => {
    // 监视 Nest 默认过滤器的 catch，确认异常被交还给父类。
    const parentCatch = vi
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);

    // 创建当前项目的过滤器实例。
    const filter = new DisconnectedWaitFilter();

    // destroyed 为 false，表示 HTTP 连接仍然没有被销毁。
    const response = { destroyed: false } as Response;

    // 构造过滤器需要的最小 HTTP 上下文。
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    // 使用与排队取消完全相同的异常名称和消息。
    const exception = new DOMException('等待任务已取消', 'AbortError');

    try {
      // 执行过滤器。
      filter.catch(exception, host);

      // 连接没有断开时，异常必须交给 Nest 默认过滤器。
      expect(parentCatch).toHaveBeenCalledOnce();
      expect(parentCatch).toHaveBeenCalledWith(exception, host);
    } finally {
      // 恢复父类方法，避免影响其他测试。
      parentCatch.mockRestore();
    }
  });

  it('连接已断开时，会吞掉运行中 worker 的预期取消异常', () => {
    // 监视 Nest 默认过滤器，确认预期取消不会继续记录错误。
    const parentCatch = vi
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);

    const filter = new DisconnectedWaitFilter();

    // destroyed 为 true，表示客户端连接已经断开。
    const response = { destroyed: true } as Response;

    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    // 模拟 Piscina 取消异常被 Controller 转换后的异常。
    const exception = new DOMException(
      '正在运行的任务已取消',
      'AbortError',
    );

    try {
      filter.catch(exception, host);

      // 预期取消不应交给 Nest 默认异常处理器。
      expect(parentCatch).not.toHaveBeenCalled();
    } finally {
      parentCatch.mockRestore();
    }
  });
});