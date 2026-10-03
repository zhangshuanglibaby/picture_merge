import { Module } from '@nestjs/common';
import { StitchesService } from './stitches.service.js';
// 引入刚创建的控制器，用来注册 /images/stitch 路由。
import { StitchesController } from './stitches.controller.js';
// 引入临时目录拦截器，交由 NestJS 创建。
import { UploadWorkspaceInterceptor } from './upload-workspace.interceptor.js';

// 把图片拼接相关的服务归到同一个功能模块。
@Module({
  controllers: [StitchesController],
  providers: [StitchesService, UploadWorkspaceInterceptor]
})
export class StitchesModule { }