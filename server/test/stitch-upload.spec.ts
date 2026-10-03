// 引入 Node.js 路径工具，拼出测试图片的绝对路径。
import { join } from 'node:path';
// 引入 NestJS 应用类型，保存测试期间创建的应用。
import type { INestApplication } from '@nestjs/common';
// 引入 NestJS 测试工具，用真实模块创建测试应用。
import { Test } from '@nestjs/testing';
// 引入 HTTP 测试工具，向测试应用发送 multipart 上传请求。
import request from 'supertest';
// 引入 Vitest 的测试分组、断言和启动/清理钩子。
import { afterAll, beforeAll, describe, it } from 'vitest';
// 引入真正的应用模块，使测试经过路由、拦截器和校验服务。
import { AppModule } from '../src/app.module.js';

// 从 server 目录定位已有的测试图片。
const validImage = join(process.cwd(), 'test/fixtures/overlap-1.png');
const invalidImage = join(process.cwd(), 'test/fixtures/invalid.png');

describe('POST /images/stitch', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // 根据真正的应用模块创建测试应用，不占用固定的 3000 端口。
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // 测试结束后关闭应用，避免测试进程一直运行。
    if (app) {
      await app.close();
    }
  });

  it('两张有效图片通过校验，但拼接尚未实现', async () => {
    await request(app.getHttpServer())
      .post('/images/stitch')
      // 两个文件都必须使用接口约定的 images 字段名。
      .attach('images', validImage)
      .attach('images', validImage)
      .expect(501)
      .expect({
        code: 'NOT_IMPLEMENTED',
        message: '图片拼接功能尚未实现',
      });
  });

  it('只有一张图片时拒绝请求', async () => {
    await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', validImage)
      .expect(400);
  });

  it('包含无效图片时拒绝请求', async () => {
    await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', validImage)
      .attach('images', invalidImage)
      .expect(400);
  });
});