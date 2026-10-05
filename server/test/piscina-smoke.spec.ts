// 引入 Node.js 路径工具，用来定位构建后的 worker 文件。
import { join } from 'node:path';

// 引入 Piscina 类，用来创建 worker 线程池。
// 使用命名导出可以同时用于运行时和 TypeScript 类型标注。
import { Piscina } from 'piscina';

// 引入 Vitest 的测试分组、测试用例和生命周期钩子。
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

// 描述传给 worker 的数据结构。
type AdditionInput = {
  // 第一个数字。
  left: number;

  // 第二个数字。
  right: number;
};

// 描述测试使用的 Piscina 实例。
let pool: Piscina<AdditionInput, number>;

describe('Piscina 最小 worker 通信', () => {
  beforeAll(() => {
    // 创建一个只使用一个 worker 的线程池。
    // 当前只是验证通信链路，不测试并发数量。
    pool = new Piscina<AdditionInput, number>({
      // Piscina 需要加载构建后的 JavaScript 文件。
      filename: join(
        process.cwd(),
        'dist/stitches/image.worker.js',
      ),

      // 测试只启动一个 worker，结果更容易理解。
      minThreads: 1,
      maxThreads: 1,
    });
  });

  afterAll(async () => {
    // 测试结束后关闭 worker，避免 Node.js 进程无法退出。
    await pool.destroy();
  });

  it('主线程传入 2 和 3 后，worker 返回 5', async () => {
    // 把任务提交给 worker。
    const result = await pool.run({
      left: 2,
      right: 3,
    });

    // 确认 worker 的计算结果已经返回主线程。
    expect(result).toBe(5);
  });
});