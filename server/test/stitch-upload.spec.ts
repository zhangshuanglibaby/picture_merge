// 引入 Node.js 路径工具，拼出测试图片的绝对路径。
import { join } from 'node:path';
// Node.js 的异步文件工具：读取系统临时目录下有哪些文件夹。
import { readdir } from 'node:fs/promises';
// Node.js 的随机字节工具：生成不容易被 PNG 压缩的小图片测试数据。
import { randomBytes } from 'node:crypto';
// Node.js 的系统工具：找到当前电脑用于存放临时文件的目录。
import { tmpdir } from 'node:os';
// 取得 HTTP 服务器类型，以便监听服务端响应何时关闭。
import type { Server } from 'node:http';
// 引入 Sharp，用来读取接口返回的 PNG 尺寸。
import sharp from 'sharp';
// 引入 NestJS 应用类型，保存测试期间创建的应用。
import type { INestApplication } from '@nestjs/common';
// 监听 Nest 的错误日志，检查预期的断线取消是否被误记为服务端错误。
import { Logger } from '@nestjs/common';
// 引入 NestJS 测试工具，用真实模块创建测试应用。
import { Test } from '@nestjs/testing';
// 引入 HTTP 测试工具，向测试应用发送 multipart 上传请求。
import request from 'supertest';
// 引入 Vitest 的测试分组、断言和启动/清理钩子。
import { afterAll, beforeAll, describe, it, vi } from 'vitest';
// 引入真正的应用模块，使测试经过路由、拦截器和校验服务。
import { AppModule } from '../src/app.module.js';
// 引入项目统一的图片尺寸限制，让测试使用与后端相同的上限。
import { IMAGE_LIMITS } from '../src/config/image-limits.js';

// 引入真实应用使用的并发限流器。
// 测试需要取得 NestJS 容器中的同一个实例，才能真正占满控制器使用的两个位置。
import { StitchTaskLimiter } from '../src/stitches/stitch-task-limiter.js';
// 取得实际注入 Controller 的 worker 池，测试时暂时控制其返回时间。
import { StitchWorkerPool } from '../src/stitches/stitch-worker.pool.js';
// worker 返回值的类型，让模拟结果符合现有接口。
import type { StitchResult } from '../src/stitches/stitch-images.js';

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

// 无效图片。
const invalidImage = join(process.cwd(), 'test/fixtures/invalid.png');

// 等待限流器中的等待任务数量达到预期。
// HTTP 请求上传和进入 Controller 需要一点时间，因此不能立即读取队列数量。
async function waitForWaitingCount(
  limiter: StitchTaskLimiter,
  expectedCount: number,
): Promise<void> {
  // 最多等待 5 秒，避免测试异常时永久卡住。
  const deadline = Date.now() + 5_000;

  // 不断检查等待队列数量。
  while (limiter.getWaitingCount() < expectedCount) {
    // 超过时间仍未进入队列，说明接口没有正确使用等待队列。
    if (Date.now() >= deadline) {
      throw new Error(
        `等待队列数量未达到 ${expectedCount}，当前数量为 ${limiter.getWaitingCount()}`,
      );
    }

    // 暂停 10 毫秒，再检查一次。
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * 执行过程
 * limiter.acquire()
      ↓
没有空闲位置
      ↓
进入等待队列
      ↓
返回 Promise
      ↓
releaseFirst()
      ↓
waitingFirst Promise 完成
      ↓
await waitingFirst 得到释放函数
 */

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

  it('并发位置占满时返回 503/BUSY，清理工作区，释放后恢复 200', async () => {
    // 从 NestJS 应用容器中取得限流器。
    // 这里拿到的是控制器实际注入的单例，而不是测试中新建的另一个对象。
    const limiter = app.get(StitchTaskLimiter);

    // 测试开始前不应该有其他测试遗留的活动任务。
    expect(limiter.getActiveCount()).toBe(0);

    // 第一次调用占用第一个处理位置。
    const releaseFirst = limiter.tryAcquire();

    // 第二次调用占用第二个处理位置。
    const releaseSecond = limiter.tryAcquire();

    // 前两个位置已经被占用。
    // 后两个任务会进入等待队列。
    const waitingFirst = limiter.acquire();
    const waitingSecond = limiter.acquire();

    try {
      // 两次占位都必须成功，否则说明测试没有真正制造“已满”状态。
      expect(releaseFirst).not.toBeNull();
      expect(releaseSecond).not.toBeNull();

      // 记录请求开始前已有的工作区。
      // 只检查本次新增目录，避免误把旧目录当成测试残留。
      const before = new Set(
        (await readdir(tmpdir())).filter((name) =>
          name.startsWith('image-stitch-'),
        ),
      );

      // 确认等待队列已经有两个任务。
      expect(limiter.getWaitingCount()).toBe(2);

      // 现在执行中的两个位置和等待中的两个任务都已占满。
      // 第五个任务才应该返回 BUSY。

      // 此时两个处理位置都被占用，因此接口应该快速返回 503。
      const busyResponse = await request(app.getHttpServer())
        .post('/images/stitch')
        .attach('images', firstImage)
        .attach('images', secondImage)
        .expect(503);

      // 确认业务错误码是 BUSY，而不是普通的处理失败。
      expect(busyResponse.body).toMatchObject({
        code: 'BUSY',
        message: '当前处理任务较多，请稍后重试',
      });

      // BUSY 请求虽然没有进入图片处理，但仍然创建过临时工作区。
      // 请求结束后不应留下本次新增的 image-stitch- 目录。
      const leftovers = (await readdir(tmpdir())).filter(
        (name) => name.startsWith('image-stitch-') && !before.has(name),
      );
      expect(leftovers).toEqual([]);

      // 先释放两个正在执行的位置。
      releaseFirst?.();
      releaseSecond?.();

      // 被唤醒的等待任务会接管刚刚释放的位置。
      const releaseQueuedFirst = await waitingFirst;
      const releaseQueuedSecond = await waitingSecond;

      // 再释放两个等待任务接管的位置。
      releaseQueuedFirst?.();
      releaseQueuedSecond?.();

      // 所有执行任务和等待任务都已经结束。
      expect(limiter.getActiveCount()).toBe(0);
      expect(limiter.getWaitingCount()).toBe(0);

      // 发送同样的有效请求，验证释放后接口恢复正常。
      const recoveredResponse = await request(app.getHttpServer())
        .post('/images/stitch')
        .attach('images', firstImage)
        .attach('images', secondImage)
        .expect(200);

      // 成功响应应该是 PNG 图片，而不是 JSON 错误。
      expect(recoveredResponse.headers['content-type']).toMatch(/image\/png/);

      // 确认控制器在正常请求结束时也归还了处理位置。
      expect(limiter.getActiveCount()).toBe(0);
    } finally {
      // 即使前面的断言失败，也要释放正在执行的位置。
      releaseFirst?.();
      releaseSecond?.();
      // 释放等待任务接管的位置。
      const releaseQueuedFirst = await waitingFirst;
      const releaseQueuedSecond = await waitingSecond;

      // 释放等待任务占用的位置。
      releaseQueuedFirst?.();
      releaseQueuedSecond?.();

      // 防止重复释放影响后面的测试。
      expect(limiter.getActiveCount()).toBe(0);
      expect(limiter.getWaitingCount()).toBe(0);
    }
  });

  it('拼接结果超过高度上限时返回 422，并释放资源后恢复正常', async () => {
    // 取得真实应用中的限流器实例。
    // 这样才能检查这次请求结束后，并发占用数量是否归零。
    const limiter = app.get(StitchTaskLimiter);

    // 记录请求开始前已经存在的临时工作区。
    // 测试结束后应恢复到同样的状态。
    const before = new Set(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith('image-stitch-'),
      ),
    );

    // 每张图片比输出高度上限的一半多 1 行。
    // 两张图片合计后一定会超过最大输出高度。
    const singleHeight = Math.floor(IMAGE_LIMITS.maxOutputHeight / 2) + 1;

    // 创建一张合法但高度很大的 PNG 图片。
    const imageBuffer = await sharp({
      create: {
        width: 1,
        height: singleHeight,
        channels: 3,
        background: '#ffffff',
      },
    }).png().toBuffer();

    // 发送会导致拼接结果超出高度上限的请求。
    const response = await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', imageBuffer, 'first.png')
      .attach('images', imageBuffer, 'second.png')
      .expect(422);

    // 失败时应该返回 JSON 错误，而不是不完整的 PNG。
    expect(response.headers['content-type']).toMatch(/application\/json/);

    // 确认业务错误码和错误信息保持不变。
    expect(response.body).toMatchObject({
      code: 'OUTPUT_TOO_LARGE',
      message: '拼接结果超出处理范围',
    });

    // worker 失败后，控制器的 finally 应该释放并发位置。
    expect(limiter.getActiveCount()).toBe(0);

    // worker 失败后，上传拦截器也应该清理临时工作区。
    const after = new Set(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith('image-stitch-'),
      ),
    );
    expect(after).toEqual(before);

    // 再发送一次正常请求，验证失败不会让接口永久处于 BUSY 或异常状态。
    const recoveredResponse = await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', firstImage)
      .attach('images', secondImage)
      .expect(200);

    // 恢复请求应该返回正常的 PNG。
    expect(recoveredResponse.headers['content-type']).toMatch(/image\/png/);

    // 正常请求结束后，并发位置也应该归零。
    expect(limiter.getActiveCount()).toBe(0);
  }, 30_000);

  it('上传六张图片时拒绝请求，并清理临时目录', async () => {
    // 记录请求开始前，系统临时目录中已有的本项目工作目录。
    // Set 是一个集合，方便稍后判断某个目录是否原本就存在。
    const before = new Set(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith('image-stitch-'),
      ),
    );

    // images 是接口约定的上传字段名。
    // 六次上传同一张有效图片即可测试“数量上限”；
    // 这里不需要准备六张内容不同的图片。
    // 保存实际响应，供下面查看响应头和响应体。
    // 前五张可能已经保存到磁盘；上传第六张时，Multer 会拒绝请求。
    const response = await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', firstImage)
      .attach('images', firstImage)
      .attach('images', firstImage)
      .attach('images', firstImage)
      .attach('images', firstImage)
      .attach('images', firstImage)
      .expect(400);
    // 确认返回给前端的仍然是约定好的业务错误。
    expect(response.body).toMatchObject({
      code: 'INVALID_COUNT',
      message: '请选择 2～5 张图片',
    });

    // 请求结束后再次查看临时目录，只挑出“这次请求之后新出现”的目录。
    const after = (await readdir(tmpdir())).filter(
      (name) => name.startsWith('image-stitch-') && !before.has(name),
    );
    // 即使上传在进入 Controller 之前就失败，也不能留下新目录。
    expect(after).toEqual([]);
  });

  it('单张图片超过上传大小上限时返回明确错误码', async () => {
    // 上传前记录本项目已经存在的临时目录。
    // Set 方便我们稍后区分“原本就有”和“本次请求新增”的目录。
    const before = new Set(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith('image-stitch-'),
      ),
    );

    // 创建比单张上传上限多 1 字节的数据。
    // 这里不需要真实图片，因为超限文件应在上传阶段被拒绝。
    const oversizedFile = Buffer.alloc(IMAGE_LIMITS.maxFileBytes + 1);

    // 先上传有效图片，再上传超限文件：
    // 这样可以检查前一张已上传的图片是否也被清理。
    const response = await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', firstImage)
      .attach('images', oversizedFile, 'oversized.png')
      .expect(413);

    // 确认前端收到的是约定好的“单张图片过大”错误。
    expect(response.body).toMatchObject({
      code: 'IMAGE_TOO_LARGE',
      message: '单张图片过大',
    });

    // 请求结束后，只寻找本次请求新增且仍然存在的工作目录。
    const leftovers = (await readdir(tmpdir())).filter(
      (name) => name.startsWith('image-stitch-') && !before.has(name),
    );

    // 不应留下原图，也不应留下本次请求的临时目录。
    expect(leftovers).toEqual([]);
  }, 30_000);

  it('上传字段名不是 images 时返回明确错误码，并清理临时目录', async () => {
    // 记录请求前已有的工作目录。
    // 稍后只检查“本次请求新产生”的目录，不误判以前的目录。
    const before = new Set(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith('image-stitch-'),
      ),
    );

    // 第一张使用正确字段 images，允许它先写入临时目录。
    // 第二张故意使用错误字段 photos，让上传过程在中途失败。
    const response = await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', firstImage)
      .attach('photos', secondImage)
      .expect(400);

    // 确认错误信息仍符合前后端约定。
    expect(response.body).toMatchObject({
      code: 'INVALID_COUNT',
      message: '请使用 images 字段上传图片',
    });

    // 请求结束后，找出仍然存在的“本次新增”目录。
    const leftovers = (await readdir(tmpdir())).filter(
      (name) => name.startsWith('image-stitch-') && !before.has(name),
    );

    // 即使上传到一半失败，已经上传的第一张也不能遗留在磁盘。
    expect(leftovers).toEqual([]);
  });

  it('整组图片超过 50 MiB 时拒绝请求并清理临时目录', async () => {
    // 记住请求前已有的工作目录，避免把旧目录误认为本次残留。
    const before = new Set(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith('image-stitch-'),
      ),
    );

    // 生成一张 2304 × 2048 的真实 PNG。
    // 随机像素不容易被压缩；关闭 PNG 压缩使文件大小更稳定。
    const imageBuffer = await sharp(
      randomBytes(2304 * 2048 * 3),
      { raw: { width: 2304, height: 2048, channels: 3 } },
    ).png({ compressionLevel: 0 }).toBuffer();

    // 确认单张没有超过 15 MiB，但四张相加超过 50 MiB。
    // 这样测到的是“整组限制”，不是“单文件限制”。
    expect(imageBuffer.length).toBeLessThan(IMAGE_LIMITS.maxFileBytes);
    expect(imageBuffer.length * 4).toBeGreaterThan(
      IMAGE_LIMITS.maxUploadBytes,
    );

    // 将同一份合法图片作为四个文件上传。
    const response = await request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', imageBuffer, 'first.png')
      .attach('images', imageBuffer, 'second.png')
      .attach('images', imageBuffer, 'third.png')
      .attach('images', imageBuffer, 'fourth.png')
      .expect(413);

    // 检查前端能收到明确的业务错误，而不只是 HTTP 状态码。
    expect(response.body).toMatchObject({
      code: 'IMAGE_TOO_LARGE',
      message: '本次上传总大小超出限制',
    });

    // 检查本次上传的图片和工作目录都没有遗留。
    const leftovers = (await readdir(tmpdir())).filter(
      (name) => name.startsWith('image-stitch-') && !before.has(name),
    );
    expect(leftovers).toEqual([]);
  }, 60_000);

  it('HTTP 请求进入等待队列后，释放位置时最终返回 200', async () => {
    // 取得 Controller 实际使用的限流器单例。
    const limiter = app.get(StitchTaskLimiter);

    // 记录请求开始前已有的临时工作区。
    const before = new Set(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith('image-stitch-'),
      ),
    );

    // 先占满两个正在执行的位置。
    const releaseFirst = limiter.tryAcquire();
    const releaseSecond = limiter.tryAcquire();

    // 创建并立即启动第一个 HTTP 请求。
    // then() 会让 Supertest 真正开始发送请求。
    const firstQueuedRequest = request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', firstImage)
      .attach('images', secondImage)
      .expect(200)
      .then((response) => response);

    // 创建并立即启动第二个 HTTP 请求。
    const secondQueuedRequest = request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', firstImage)
      .attach('images', secondImage)
      .expect(200)
      .then((response) => response);

    try {
      // 确认两个 HTTP 请求都已经进入等待队列。
      await waitForWaitingCount(limiter, 2);

      // 释放两个正在执行的位置。
      // 等待队列中的请求会依次接管这些位置。
      releaseFirst?.();
      releaseSecond?.();

      // 两个等待请求都应该最终处理成功。
      const [firstResponse, secondResponse] = await Promise.all([
        firstQueuedRequest,
        secondQueuedRequest,
      ]);

      // 两个请求都应该返回 PNG。
      expect(firstResponse.headers['content-type']).toMatch(/image\/png/);
      expect(secondResponse.headers['content-type']).toMatch(/image\/png/);

      // 所有请求结束后，不应再有执行中的任务或等待中的任务。
      expect(limiter.getActiveCount()).toBe(0);
      expect(limiter.getWaitingCount()).toBe(0);

      // 检查两个请求的临时工作区都已经清理。
      const after = new Set(
        (await readdir(tmpdir())).filter((name) =>
          name.startsWith('image-stitch-'),
        ),
      );

      expect(after).toEqual(before);
    } finally {
      // 测试失败时也释放预先占用的位置。
      releaseFirst?.();
      releaseSecond?.();

      // 等待两个 HTTP 请求结束，避免影响后续测试。
      await Promise.allSettled([
        firstQueuedRequest,
        secondQueuedRequest,
      ]);
    }
  }, 30_000);
  it('排队请求断开后从等待队列移除', async () => {
    // 使用 Controller 正在使用的同一个限流器，先占满两个执行位置。
    const limiter = app.get(StitchTaskLimiter);

    // 只追踪本次请求新建的工作区，不误判之前已有的目录。
    const before = new Set(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith('image-stitch-'),
      ),
    );

    const releaseFirst = limiter.tryAcquire();
    const releaseSecond = limiter.tryAcquire();

    // 创建上传请求；调用 then() 后，请求才真正开始发送。
    const queuedRequest = request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', firstImage)
      .attach('images', secondImage);

    // 只记录本测试期间的错误日志；不改变 Logger 原本的输出行为。
    const errorSpy = vi.spyOn(Logger.prototype, 'error');

    // 提前接住客户端主动断开产生的错误，避免未处理的 Promise 拒绝。
    const requestSettled = queuedRequest.then(
      () => undefined,
      () => undefined,
    );

    try {
      // 确认 HTTP 请求确实进入了等待队列。
      await waitForWaitingCount(limiter, 1);

      // 请求已进入队列，此时找出它新建的工作区。
      const createdWorkspaces = (await readdir(tmpdir())).filter(
        (name) => name.startsWith('image-stitch-') && !before.has(name),
      );

      // 确认确实创建了一个工作区，里面保存了两张上传图片。
      expect(createdWorkspaces).toHaveLength(1);
      expect(await readdir(join(tmpdir(), createdWorkspaces[0]))).toHaveLength(2);

      // 模拟客户端在排队期间断开连接。
      queuedRequest.abort();
      await requestSettled;

      // 给服务端一点时间处理断开事件，但最多等 1 秒。
      const deadline = Date.now() + 1_000;
      while (limiter.getWaitingCount() !== 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 正确行为：等待任务被移除；两个预占的位置仍在使用。
      expect(limiter.getWaitingCount()).toBe(0);
      expect(limiter.getActiveCount()).toBe(2);

      // 清理是异步的：反复检查本次工作区，最多等待 2 秒。
      await expect.poll(async () => {
        const current = new Set(await readdir(tmpdir()));

        // 返回本次创建、但仍留在磁盘上的目录。
        return createdWorkspaces.filter((name) => current.has(name));
      }, { interval: 10, timeout: 2_000 }).toEqual([]);

      // 等一个事件循环轮次，让服务端完成清理之后的异常处理。
      await new Promise<void>((resolve) => setImmediate(resolve));

      // 断线取消属于预期行为，不应作为未知服务端错误记录。
      const loggedAbortError = errorSpy.mock.calls.some(
        ([message]) =>
          message instanceof DOMException && message.name === 'AbortError',
      );
      expect(loggedAbortError).toBe(false);
    } finally {
      // 即使断言失败，也归还位置，避免测试结束后留下排队任务。
      queuedRequest.abort();
      releaseFirst?.();
      releaseSecond?.();
      await requestSettled;

      // 等服务端收尾，避免影响其他测试；最多等待 5 秒。
      const deadline = Date.now() + 5_000;
      while (
        (limiter.getActiveCount() !== 0 ||
          limiter.getWaitingCount() !== 0) &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      // 恢复原始日志方法，避免影响其他测试。
      errorSpy.mockRestore();
    }
  }, 10_000);

  it('worker 执行期间断线不提前清理工作区', async () => {
    // 记录已有目录，只检查本次请求新建的工作区。
    const before = new Set(
      (await readdir(tmpdir())).filter((name) => name.startsWith('image-stitch-')),
    );
    const limiter = app.get(StitchTaskLimiter);
    const server = app.getHttpServer() as Server;

    // 观察服务端响应确实收到了连接关闭事件。
    let responseClosed = false;
    server.once('request', (_request, response) => {
      response.once('close', () => { responseClosed = true; });
    });

    // 创建一个暂不完成的 Promise，模拟仍在处理的 worker。
    let finishWorker!: (result: StitchResult) => void;
    const workerResult = new Promise<StitchResult>((resolve) => {
      finishWorker = resolve;
    });
    // 客户端断开后不会读取这份模拟 PNG；这里只测试完成顺序。
    const fakeResult: StitchResult = {
      png: Buffer.from('fake-png'),
      cropTopPx: [],
      unconfirmedImageIndices: [],
    };
    const workerSpy = vi.spyOn(app.get(StitchWorkerPool), 'run')
      .mockReturnValue(workerResult);

    // 立即发起上传；接住主动断开产生的客户端错误。
    const upload = request(server).post('/images/stitch')
      .attach('images', firstImage)
      .attach('images', secondImage);
    const requestDone = upload.then(() => undefined, () => undefined);

    try {
      // 确认 Controller 已调用 worker，但模拟的 worker 还未完成。
      await expect.poll(() => workerSpy.mock.calls.length).toBe(1);
      const created = (await readdir(tmpdir())).filter(
        (name) => name.startsWith('image-stitch-') && !before.has(name),
      );
      expect(created).toHaveLength(1);

      // 断开客户端，并确认服务端观察到了响应关闭。
      upload.abort();

      // 读取 Controller 传给 worker 的运行阶段取消信号。
      const workerSignal = workerSpy.mock.calls[0]?.[1] as AbortSignal;

      // Controller 应该已经把取消信号传给 worker。
      expect(workerSignal).toBeInstanceOf(AbortSignal);

      // 等待响应关闭监听异步触发 workerAbort.abort()。
      await expect
        .poll(() => workerSignal.aborted, { timeout: 2_000 })
        .toBe(true);

      await expect.poll(() => responseClosed, { timeout: 2_000 }).toBe(true);
      await requestDone;

      // worker 尚未完成：位置和两张上传图片都必须保留。
      expect(limiter.getActiveCount()).toBe(1);
      expect(await readdir(join(tmpdir(), created[0]))).toHaveLength(2);

      // 现在才让 worker 完成；随后工作区和执行位置应被清理。
      finishWorker(fakeResult);
      await expect.poll(async () => {
        const current = new Set(await readdir(tmpdir()));
        return created.filter((name) => current.has(name));
      }, { timeout: 2_000 }).toEqual([]);
      expect(limiter.getActiveCount()).toBe(0);
    } finally {
      // 断言失败时也结束模拟任务、断开请求并恢复原方法。
      finishWorker(fakeResult);
      upload.abort();
      await requestDone;
      workerSpy.mockRestore();
    }
  }, 10_000);

  it('worker 取消后释放执行位置并清理工作区', async () => {
    // 记录测试前已有的工作区，避免误判其他目录。
    const before = new Set(
      (await readdir(tmpdir())).filter((name) =>
        name.startsWith('image-stitch-'),
      ),
    );

    const limiter = app.get(StitchTaskLimiter);
    const workerPool = app.get(StitchWorkerPool);

    // 模拟 worker 收到取消信号后抛出 AbortError。
    const workerSpy = vi.spyOn(workerPool, 'run')
      .mockImplementation((_input, signal) => {
        return new Promise<StitchResult>((_resolve, reject) => {
          // 监听 Controller 传入的运行阶段取消信号。
          signal?.addEventListener(
            'abort',
            () => {
              // 模拟真实取消异常。
              reject(
                new DOMException(
                  'The task has been aborted',
                  'AbortError',
                ),
              );
            },
            { once: true },
          );
        });
      });

    const upload = request(app.getHttpServer())
      .post('/images/stitch')
      .attach('images', firstImage)
      .attach('images', secondImage);

    // 主动断开客户端请求，并接住断开产生的请求异常。
    const requestDone = upload.then(
      () => undefined,
      () => undefined,
    );

    try {
      // 确认 worker 已经开始执行。
      await expect.poll(() => workerSpy.mock.calls.length).toBe(1);

      // 取得 Controller 传给 worker 的取消信号。
      const workerSignal = workerSpy.mock.calls[0]?.[1] as AbortSignal;

      // 模拟客户端断开。
      upload.abort();

      // 等待响应关闭事件触发 worker 取消。
      await expect
        .poll(() => workerSignal.aborted, { timeout: 2_000 })
        .toBe(true);

      // 等待 Controller、过滤器和工作区拦截器完成收尾。
      await requestDone;

      // 执行位置最终必须释放。
      await expect
        .poll(() => limiter.getActiveCount(), { timeout: 2_000 })
        .toBe(0);

      // 本次请求创建的工作区最终必须被删除。
      await expect.poll(async () => {
        const current = new Set(await readdir(tmpdir()));

        return [...current].filter(
          (name) => name.startsWith('image-stitch-') && !before.has(name),
        );
      }, { timeout: 2_000 }).toEqual([]);
    } finally {
      // 测试失败时恢复 worker 方法，避免影响后续测试。
      upload.abort();
      await requestDone;
      workerSpy.mockRestore();
    }
  }, 10_000);
});