import { Module } from '@nestjs/common';

// 在文件顶部增加导入；ESM 的本地导入路径使用 .js。
import { HealthController } from './health.controller.js';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { StitchesModule } from './stitches/stitches.module.js';

@Module({
  imports: [StitchesModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule { }
