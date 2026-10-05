import { Module } from '@nestjs/common';
import { StitchesService } from './stitches.service.js';
// 引入刚创建的控制器，用来注册 /images/stitch 路由。
import { StitchesController } from './stitches.controller.js';
// 引入临时目录拦截器，交由 NestJS 创建。
import { UploadWorkspaceInterceptor } from './upload-workspace.interceptor.js';
// 引入任务限流器，让同一应用中的拼接请求共享工作位置。
import { StitchTaskLimiter } from './stitch-task-limiter.js';
// 引入 worker 池服务，让 NestJS 创建并管理 Piscina。
import { StitchWorkerPool } from './stitch-worker.pool.js';

// 把图片拼接相关的服务归到同一个功能模块。
@Module({
  controllers: [StitchesController],
  providers: [
    StitchesService,
    UploadWorkspaceInterceptor,
    StitchTaskLimiter, // 交给 NestJS 创建，并供控制器使用
    StitchWorkerPool, // 注册可复用的 Piscina worker 池
  ]
})
export class StitchesModule { }