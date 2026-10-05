// 引入路径工具，定位测试专用 worker。
import { join } from 'node:path';

// 引入 Piscina，创建测试线程池。
import { Piscina } from 'piscina';

// 引入 Vitest 测试工具。
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

// 描述测试 worker 接收的数据。
type CrashWorkerInput = {
  // crash 模式会让 worker 意外退出。
  // quick 模式正常返回。
  mode: 'crash' | 'quick';
};

// 测试线程池只使用一个 worker，便于确认它是否被恢复。
let pool: Piscina<CrashWorkerInput, string>;

describe('Piscina worker 异常退出恢复', () => {
  beforeAll(() => {
    // 使用测试专用 worker，不影响正式图片处理 worker。
    pool = new Piscina<CrashWorkerInput, string>({
      // 指向刚刚创建的测试 worker。
      filename: join(
        process.cwd(),
        'test/fixtures/crash.worker.mjs',
      ),

      // 只保留一个 worker，方便观察恢复行为。
      minThreads: 1,
      maxThreads: 1,
    });
  });

  afterAll(async () => {
    // 测试结束后关闭线程池，避免 Node.js 进程无法退出。
    await pool.destroy();
  });

  it('worker 意外退出后，线程池可以处理后续任务', async () => {
    // 提交一个会让 worker 线程退出的任务。
    const crashedTask = pool.run({
      mode: 'crash',
    });

    // 意外退出的任务应该失败，而不是正常返回。
    await expect(crashedTask).rejects.toBeInstanceOf(Error);

    // Piscina 应该重新准备 worker，后续任务仍能正常执行。
    await expect(
      pool.run({
        mode: 'quick',
      }),
    ).resolves.toBe('完成');
  });
});