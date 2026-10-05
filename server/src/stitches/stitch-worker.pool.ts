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

// 引入 worker 接收的数据类型和返回结果类型。
import type {
  StitchWorkerInput,
  StitchWorkerOutput,
} from './image.worker.js';

// 引入 worker 返回的图片拼接结果类型。
import type { StitchResult } from './stitch-images.js';

// 引入业务错误类。
// 主线程收到 worker 的错误对象后，需要重新创建 StitchError。
import { StitchError } from './stitch.error.js';


@Injectable()
export class StitchWorkerPool implements OnModuleDestroy {
  // 保存一个可重复使用的 Piscina 实例。
  // 不应该每个 HTTP 请求都重新创建一个线程池。
  // Piscina 返回的是 worker 的成功或失败结果对象。
  private readonly pool: Piscina<
    StitchWorkerInput,
    StitchWorkerOutput
  >;
  constructor() {
    // 创建支持 worker 成功和失败结果的线程池。
    this.pool = new Piscina<
      StitchWorkerInput,
      StitchWorkerOutput
    >({
      // Piscina 运行构建后的 JavaScript worker 文件。
      filename: join(
        process.cwd(),
        'dist/stitches/image.worker.js',
      ),

      // 与现有两个并发处理位置保持一致。
      maxThreads: 2,
    });
  }

  /**
   * 向 worker 提交一个图片拼接任务。
   *
   * @param input 图片路径和临时工作区路径。
   * @returns worker 返回的 PNG 和拼接结果信息。
   */
  run(
    input: StitchWorkerInput,
  ): Promise<StitchResult> {
    return this.runWorker(input);
  }

  // 单独处理 worker 返回结果，保持 run() 对控制器返回 StitchResult。
  private async runWorker(
    input: StitchWorkerInput,
  ): Promise<StitchResult> {
    // 等待 worker 返回成功或失败结果。
    const output = await this.pool.run(input);

    // worker 成功时，把图片结果交还给控制器。
    if (output.ok) {
      return output.result;
    }

    // worker 失败时，在主线程重新创建 StitchError。
    // 这样控制器原有的 instanceof StitchError 判断可以继续工作。
    throw new StitchError(
      output.error.code,
      output.error.message,
    );
  }

  async onModuleDestroy(): Promise<void> {
    // NestJS 关闭模块时，等待并关闭 Piscina。
    // 防止测试或服务退出时仍有 worker 保持进程运行。
    await this.pool.destroy();
  }
}