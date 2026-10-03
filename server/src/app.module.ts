import { Module } from '@nestjs/common';

// 在文件顶部增加导入；ESM 的本地导入路径使用 .js。
import { HealthController } from './health.controller.js';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
