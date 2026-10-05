/**
 * 取消测试
 */

// 引入 Node.js 路径工具，用来定位测试 worker 文件。
import { join } from 'node:path';

// 引入 Piscina，用来创建真实的 worker 线程池。
import { Piscina } from 'piscina';

// 引入 Vitest 的测试分组、断言和生命周期钩子。
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';


// 描述测试 worker 接收的数据。
type CancelWorkerInput = {
  // wait 表示运行较长任务，quick 表示快速返回。
  mode: 'wait' | 'quick';

  // wait 模式需要等待的毫秒数。
  delayMs?: number;
};

// 创建一个只使用一个 worker 的线程池。
let pool: Piscina<CancelWorkerInput, string>;

describe('Piscina worker 取消', () => {
  beforeAll(() => {
    // 使用测试专用 worker，不影响正式图片处理 worker。
    pool = new Piscina<CancelWorkerInput, string>({
      filename: join(
        process.cwd(),
        'test/fixtures/cancel.worker.mjs',
      ),

      // 只有一个 worker，便于确认取消的是当前正在运行的任务。
      minThreads: 1,
      maxThreads: 1,
    });
  });

  afterAll(async () => {
    // 测试结束后关闭线程池，避免 Node.js 进程无法退出。
    await pool.destroy();
  });

  it('取消正在运行的任务后，线程池还能处理后续任务', async () => {
    // 创建本次任务专用的取消控制器。
    const controller = new AbortController();

    // 提交一个故意运行较久的任务。
    const runningTask = pool.run(
      {
        mode: 'wait',
        delayMs: 10_000,
      },
      {
        // 把取消信号交给 Piscina。
        signal: controller.signal,
      },
    );

    // 等待一小段时间，确保任务已经开始运行。
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 取消正在运行的 worker 任务。
    controller.abort();

    // 被取消的任务应以 AbortError 拒绝，而不是正常返回结果。
    await expect(runningTask).rejects.toMatchObject({
      name: 'AbortError',
    });

    // 取消后，线程池应能重新处理下一个任务。
    await expect(
      pool.run({
        mode: 'quick',
      }),
    ).resolves.toBe('完成');
  });
});