// 创建真实 HTTP 服务和客户端请求，验证客户端实际收到什么。
import { request as httpRequest, type Server } from 'node:http';
// Express 类型用于调用待测中间件，不产生运行时代码。
import type { Request, Response } from 'express';
// 使用 Vitest 检查 HTTP 状态和响应内容。
import { expect, it } from 'vitest';
// 调用项目中的真实请求体大小中间件。
import { requestSizeLimitMiddleware } from '../src/request-size-limit.middleware.js';

// 使用 Nest 测试工具创建项目实际使用的 Express 应用。
import { Test } from '@nestjs/testing';
// 使用真实应用模块，让 HTTP 请求经过实际路由。
import { AppModule } from '../src/app.module.js';

it('分块上传超过 50 MiB 时客户端收到 413 JSON', async () => {
  // 测试不会执行 main.ts，所以要在测试应用中显式注册中间件。
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.use(requestSizeLimitMiddleware);
  // 测试专用接收端：持续读取原始请求体，不进入 multipart 上传路由。
  app.use((request: Request, response: Response) => {
    request.resume();
    request.on('end', () => {
      // 未超限才返回成功；超限响应由待测中间件负责。
      if (!response.headersSent) response.end('ok');
    });
  });
  await app.init();

  // 监听随机端口，供下方的原生 HTTP 客户端发送分块请求。
  const server = app.getHttpServer() as Server;
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', resolve),
  );

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('无法取得测试端口');
    }

    const result = await new Promise<{
      status: number;
      body: string;
    }>((resolve, reject) => {
      const client = httpRequest(
        {
          hostname: '127.0.0.1',
          port: address.port,
          method: 'POST',
          path: '/images/stitch',
          // 不设置 Content-Length，明确使用分块传输。
          headers: { 'Transfer-Encoding': 'chunked' },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () =>
            resolve({
              status: response.statusCode ?? 0,
              body: Buffer.concat(chunks).toString('utf8'),
            }),
          );
        },
      );

      // 如果服务端提前断开连接，测试应失败并暴露原因。
      client.on('error', reject);

      // 重用 1 MiB 缓冲区，发送 51 MiB，不创建 51 份数据。
      const chunk = Buffer.alloc(1024 * 1024);
      for (let i = 0; i < 51; i++) {
        client.write(chunk);
      }
      client.end();
    });

    expect(result.status).toBe(413);
    expect(JSON.parse(result.body)).toMatchObject({
      code: 'IMAGE_TOO_LARGE',
      message: '本次上传总大小超出限制',
    });
  } finally {
    // 关闭测试应用，避免留下 HTTP 服务和 worker。
    await app.close();
  }
}, 15_000);