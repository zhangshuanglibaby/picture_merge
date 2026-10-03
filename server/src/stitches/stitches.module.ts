import { Module } from '@nestjs/common';
import { StitchesService } from './stitches.service.js';

// 把图片拼接相关的服务归到同一个功能模块。
@Module({
  providers: [StitchesService]
})
export class StitchesModule { }