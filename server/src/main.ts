import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// ESM 项目的本地导入路径使用 .js 后缀。
import { validateImageLimits, IMAGE_LIMITS } from './config/image-limits.js';

// 启动前清理上一次进程异常退出留下的过期工作区。
import { cleanupStaleUploadWorkspaces } from './stitches/stale-upload-workspace.js';

// 引入 Express 请求、响应和中间件函数类型。
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  // 配置有误时立即停止启动，避免服务带着错误限制运行。
  validateImageLimits();

  // Nest 启动前清理超过 24 小时的 image-stitch-* 目录。
  // 如果清扫失败，直接阻止启动，避免服务带着未知残留继续运行。
  const removedCount = await cleanupStaleUploadWorkspaces();

  if (removedCount > 0) {
    // 只在确实删除目录时输出提示，避免正常启动产生无用日志。
    console.info(`启动前清理了 ${removedCount} 个过期上传工作区`);
  }

  const app = await NestFactory.create(AppModule);

  // 在 Multer 接收上传文件之前检查整次请求声明的大小。
  // 反向代理部署后也要配置相同的 50 MiB 限制。
  app.use((request: Request, response: Response, next: NextFunction) => {
    // Content-Length 表示整个 HTTP 请求体的字节数。
    const contentLength = Number(request.headers['content-length']);

    // 只有请求明确声明了长度，且长度超过限制时才提前拒绝。
    if (
      Number.isFinite(contentLength) &&
      contentLength > IMAGE_LIMITS.maxUploadBytes
    ) {
      // 使用现有业务错误码，保持和服务层校验一致。
      response.status(413).json({
        code: 'IMAGE_TOO_LARGE',
        message: '本次上传总大小超出限制',
      });
      return;
    }

    // 未超过限制，继续交给 Multer 和 Controller。
    next();
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
