// 引入 NestJS 的 Injectable，让这个类可以交给 NestJS 管理。
// 引入 OnModuleDestroy，让模块关闭时可以清理 worker。
import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';

// 引入路径工具，用来定位构建后的 worker 文件。
import { join } from 'node:path';

// 引入 Piscina 的类，用来创建 worker 线程池。
import { Piscina } from 'piscina';

// 引入 worker 接收的数据类型。
import type { StitchWorkerInput } from './image.worker.js';

// 引入 worker 返回的图片拼接结果类型。
import type { StitchResult } from './stitch-images.js';


@Injectable()
export class StitchWorkerPool implements OnModuleDestroy {
  // 保存一个可重复使用的 Piscina 实例。
  // 不应该每个 HTTP 请求都重新创建一个线程池。
  private readonly pool: Piscina<StitchWorkerInput, StitchResult>;
  constructor() {
    // 创建 worker 线程池。
    this.pool = new Piscina<StitchWorkerInput, StitchResult>({
      // Piscina 运行的是构建后的 JavaScript 文件。
      // 因此运行测试或启动服务前，需要先执行 npm run build。
      filename: join(
        process.cwd(),
        'dist/stitches/image.worker.js',
      ),

      // 暂时最多使用两个 worker，
      // 与现有 StitchTaskLimiter 的两个处理位置保持一致。
      maxThreads: 2,
    });
  }

  /**
   * 向 worker 提交一个图片拼接任务。
   *
   * @param input 图片路径和临时工作区路径。
   * @returns worker 返回的 PNG 和拼接结果信息。
   */
  run(input: StitchWorkerInput): Promise<StitchResult> {
    // 将任务交给 Piscina。
    // 这里不会阻塞主线程等待计算过程。
    return this.pool.run(input);
  }

  async onModuleDestroy(): Promise<void> {
    // NestJS 关闭模块时，等待并关闭 Piscina。
    // 防止测试或服务退出时仍有 worker 保持进程运行。
    await this.pool.destroy();
  }
}