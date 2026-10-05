// 引入 Node.js 路径工具，拼出测试图片的绝对路径。
import { join } from 'node:path';
// 引入 Sharp，用来读取接口返回的 PNG 尺寸。
import sharp from 'sharp';
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
// 引入项目统一的图片尺寸限制，让测试使用与后端相同的上限。
import { IMAGE_LIMITS } from '../src/config/image-limits.js';

// 从 server 目录定位已有的测试图片。
// 第一张测试图片。
const firstImage = join(
  process.cwd(),
  'test/fixtures/overlap-1.png',
);

// 第二张测试图片，和第一张有 100 行重叠。
const secondImage = join(
  process.cwd(),
  'test/fixtures/overlap-2.png',
);
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

  it('上传两张图片后返回拼接后的 PNG', async () => {
    // 请求接口，上传第一张图片和第二张图片。
    const response = await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', firstImage)
      .attach('images', secondImage)
      .expect(200);

    // 检查接口返回的类型确实是二进制 Buffer。
    expect(Buffer.isBuffer(response.body)).toBe(true);

    // PNG 文件至少应该有内容。
    expect(response.body.length).toBeGreaterThan(0);

    // 检查响应头是否声明为 PNG。
    expect(response.headers['content-type']).toMatch(/image\/png/);

    // 检查响应头是否允许浏览器直接预览。
    expect(response.headers['content-disposition'])
      .toContain('inline');

    // 打印返回值是否真的是 Buffer 二进制数据。
    console.log('是否为 Buffer：', Buffer.isBuffer(response.body));

    // 打印返回数据的字节长度。
    console.log('返回数据长度：', response.body?.length);

    // PNG 文件固定应该以这 8 个字节开头：
    // 89 50 4e 47 0d 0a 1a 0a
    console.log(
      '文件头：',
      Buffer.isBuffer(response.body)
        ? response.body.subarray(0, 8).toString('hex')
        : '不是 Buffer',
    );

    // 打印接口响应类型。
    console.log('Content-Type：', response.headers['content-type']);

    // 解析接口返回的 PNG，读取最终图片尺寸。
    const metadata = await sharp(response.body).metadata();

    // overlap-1 和 overlap-2 都是 240 宽，识别出的重叠高度是 100 行。
    // 最终高度 = 320 + 320 - 100 = 540。
    expect(metadata.width).toBe(240);
    expect(metadata.height).toBe(540);
  });

  it('只有一张图片时拒绝请求', async () => {
    await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', firstImage)
      .expect(400);
  });

  it('包含无效图片时拒绝请求', async () => {
    await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', firstImage)
      .attach('images', invalidImage)
      .expect(400);
  });

  it('上传五张图片后返回完整拼接结果', async () => {
    // 创建五张测试图片的完整路径。
    const mixedImages = [1, 2, 3, 4, 5].map((number) =>
      join(
        process.cwd(),
        `test/fixtures/mixed-${number}.png`,
      ),
    );

    // 依次把五张图片上传到同一个 images 字段。
    const response = await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', mixedImages[0])
      .attach('images', mixedImages[1])
      .attach('images', mixedImages[2])
      .attach('images', mixedImages[3])
      .attach('images', mixedImages[4])
      .expect(200);

    // 读取接口返回的 PNG 尺寸。
    const metadata = await sharp(response.body).metadata();

    // 五张图片拼接后，宽度保持 240。
    expect(metadata.width).toBe(240);

    // 预期裁切计划为 [0, 80, 0, 70, 0]。
    // 高度为：
    // 300 + (300 - 80) + 300 + (300 - 70) + 300 = 1350。
    expect(metadata.height).toBe(1350);
  });

  it('拼接结果超过高度上限时返回 422 和明确错误码', async () => {
    // 每张图比输出高度上限的一半多 1 行。
    // 当前上限为 30000，因此单张是 15001 行，两张合计 30002 行。
    const singleHeight = Math.floor(IMAGE_LIMITS.maxOutputHeight / 2) + 1;

    // 在内存里生成合法的 PNG；宽度仅 1 像素，避免占用大量内存。
    // 纯白图片不能提供可靠的重叠证据，因此不会自动裁掉其中一张。
    const imageBuffer = await sharp({
      create: {
        width: 1,
        height: singleHeight,
        channels: 3,
        background: '#ffffff',
      },
    }).png().toBuffer();

    // 像前端一样，向真正的上传接口发送两张图片。
    const response = await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', imageBuffer, 'first.png')
      .attach('images', imageBuffer, 'second.png')
      .expect(422);

    // 失败时应返回 JSON 错误，而不是一张不完整的 PNG。
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toMatchObject({
      code: 'OUTPUT_TOO_LARGE',
      message: '拼接结果超出处理范围',
    });
  }, 30_000);
});