import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// ESM 项目的本地导入路径使用 .js 后缀。
import { validateImageLimits } from './config/image-limits.js';

// 启动前清理上一次进程异常退出留下的过期工作区。
import { cleanupStaleUploadWorkspaces } from './stitches/stale-upload-workspace.js';

// 引入整次 HTTP 请求体积限制中间件。
import { requestSizeLimitMiddleware } from './request-size-limit.middleware.js';

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

  // 必须在 Multer 之前注册，提前限制整个 HTTP 请求大小。
  app.use(requestSizeLimitMiddleware);

  await app.listen(process.env.PORT ?? 3000, '127.0.0.1');
}
await bootstrap();
