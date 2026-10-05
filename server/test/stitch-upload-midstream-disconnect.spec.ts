/**
 * 测试真实 HTTP 场景
 */

// 读取临时目录，检查本次请求创建的工作区。
import { readdir } from 'node:fs/promises';

// 使用真实 HTTP 请求，模拟客户端上传到一半主动断开。
import { request as httpRequest, type Server } from 'node:http';

// 获取系统临时目录。
import { tmpdir } from 'node:os';

// 组合工作区路径。
import { join } from 'node:path';

// Nest 测试应用类型。
import type { INestApplication } from '@nestjs/common';

// 创建真实 Nest 测试应用。
import { Test } from '@nestjs/testing';

// Vitest 测试工具。
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

// 导入真实应用模块，确保测试经过上传拦截器和 Multer。
import { AppModule } from '../src/app.module.js';

describe('上传中途断开时的工作区清理', () => {
  let app: INestApplication;
  let server: Server;
  let port: number;

  beforeAll(async () => {
    // 创建真实 Nest 应用。
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // 监听随机端口，给原生 HTTP 请求使用。
    server = app.getHttpServer() as Server;

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('无法取得测试服务器端口');
    }

    port = address.port;
  });

  afterAll(async () => {
    // 关闭 Nest 应用和 HTTP 服务器。
    await app.close();
  });

  it('multipart 尚未上传完时断开，也会清理已写入的工作区', async () => {
    // 记录测试开始前已有的工作区，避免误判其他测试留下的目录。
    const before = new Set(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith('image-stitch-'),
      ),
    );

    const boundary = `----test-${Date.now()}`;

    // 创建真实客户端请求。
    const client = httpRequest({
      hostname: '127.0.0.1',
      port,
      method: 'POST',
      path: '/images/stitch',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
    });

    // 客户端主动断开时，Node.js 可能产生 ECONNRESET；
    // 这是测试预期，不应让测试进程出现未处理异常。
    client.on('error', () => undefined);

    // 先发送 multipart 文件头，但故意不发送结束边界。
    client.write(
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="images"; filename="partial.png"\r\n' +
        'Content-Type: image/png\r\n\r\n',
    );

    // 发送一部分文件内容，确保 Multer 已经开始写入磁盘。
    client.write(Buffer.alloc(1024 * 1024, 0));

    // 等待本次请求创建工作区并写入部分文件。
    const workspace = await waitForPartialWorkspace(before);

    // 模拟手机网络中断或客户端主动取消上传。
    client.destroy();

    // 等待服务器处理断开事件和 finally 清理。
    await waitForWorkspaceGone(workspace);

    // 工作区最终必须不存在。
    expect(
      (await readdir(tmpdir())).includes(workspace),
    ).toBe(false);
  }, 10_000);
});

async function waitForPartialWorkspace(
  before: Set<string>,
): Promise<string> {
  const deadline = Date.now() + 3_000;

  while (Date.now() < deadline) {
    const names = (await readdir(tmpdir())).filter(
      (name) => name.startsWith('image-stitch-') && !before.has(name),
    );

    for (const name of names) {
      const files = await readdir(join(tmpdir(), name)).catch(() => []);
      if (files.length > 0) {
        return name;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error('未观察到已经写入部分文件的工作区');
}

async function waitForWorkspaceGone(name: string): Promise<void> {
  const deadline = Date.now() + 3_000;

  while (Date.now() < deadline) {
    const names = await readdir(tmpdir());

    if (!names.includes(name)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`上传断开后工作区仍未清理：${name}`);
}