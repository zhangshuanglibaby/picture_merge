import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// ESM 项目的本地导入路径使用 .js 后缀。
import { validateImageLimits } from './config/image-limits.js';

async function bootstrap() {
  // 配置有误时立即停止启动，避免服务带着错误限制运行。
  validateImageLimits();

  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
