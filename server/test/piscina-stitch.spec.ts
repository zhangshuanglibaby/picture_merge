// 引入 Node.js 文件系统工具，用来创建和删除测试工作区。
import {
  mkdtemp,
  rm,
} from 'node:fs/promises';

// 引入系统临时目录路径。
import { tmpdir } from 'node:os';

// 引入路径拼接工具。
import { join } from 'node:path';

// 引入 Sharp，用来读取 worker 返回的 PNG 尺寸。
import sharp from 'sharp';

// 引入 Piscina，用来创建 worker 线程池。
import { Piscina } from 'piscina';

// 引入 Vitest 的测试分组、断言和生命周期钩子。
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

// 引入 worker 接收的数据类型和返回结果类型。
import type {
  StitchWorkerInput,
  StitchWorkerOutput,
} from '../src/stitches/image.worker.js';

// 引入图片拼接结果的类型。
// import type {
//   StitchResult,
// } from '../src/stitches/stitch-images.js';

// 找到已有的两张重叠测试图片。
const firstImage = join(
  process.cwd(),
  'test/fixtures/overlap-1.png',
);
const secondImage = join(
  process.cwd(),
  'test/fixtures/overlap-2.png',
);

// 定义 Piscina 实例。
// worker 返回的是带 ok 标记的成功或失败对象。
let pool: Piscina<StitchWorkerInput, StitchWorkerOutput>;


describe('Piscina 图片拼接 worker', () => {
  beforeAll(() => {
    // 创建一个只使用一个 worker 的线程池。
    // 当前只验证“图片处理能否进入 worker”，不测试并发数量。
    pool = new Piscina<StitchWorkerInput, StitchWorkerOutput>({
      // Piscina 必须加载构建后的 JavaScript worker 文件。
      filename: join(
        process.cwd(),
        'dist/stitches/image.worker.js',
      ),

      // 测试阶段只启动一个 worker，便于理解和排查。
      minThreads: 1,
      maxThreads: 1,
    });
  });

  afterAll(async () => {
    // 测试结束后关闭 worker，避免测试进程无法退出。
    await pool.destroy();
  });

  it('worker 可以调用现有图片拼接流程并返回 PNG', async () => {
    // 为这次 worker 测试创建独立的临时工作区。
    const workspaceDirectory = await mkdtemp(
      join(tmpdir(), 'image-stitch-worker-test-'),
    );

    try {
      // 把图片路径和工作区路径提交给 worker。
      const workerOutput = await pool.run({
        paths: [firstImage, secondImage],
        workspaceDirectory,
      });

      // 先确认 worker 返回的是成功结构。
      // TypeScript 看到 ok 为 true 后，才能安全读取 result。
      expect(workerOutput.ok).toBe(true);

      if (!workerOutput.ok) {
        throw new Error(workerOutput.error.message);
      }


      // 确认 worker 确实返回了有内容的 PNG 数据。
      expect(workerOutput.result.png.length).toBeGreaterThan(0);

      // 解析 worker 返回的 PNG，确认它是可读取的图片。
      const metadata = await sharp(workerOutput.result.png).metadata();


      // 两张 overlap 测试图片应拼成 240 × 540。
      expect(metadata.width).toBe(240);
      expect(metadata.height).toBe(540);
    } finally {
      // 无论测试成功还是失败，都删除本次测试专属工作区。
      await rm(workspaceDirectory, {
        recursive: true,
        force: true,
      });
    }
  });
});