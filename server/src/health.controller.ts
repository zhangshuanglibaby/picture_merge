/**
 * 一个健康检查接口
 */

import { Controller, Get } from '@nestjs/common';

// 将这个控制器中的接口放在 /health 路径下。
@Controller('health')
export class HealthController {
  // 接收浏览器或其他程序发来的 GET /health 请求。
  @Get()
  check(): { status: string } {
    // 能执行到这里，说明 NestJS 服务已经能够接收和处理请求。
    return { status: 'ok' };
  }
}