import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

// 用 Vitest 检查健康接口所返回的数据。
describe('HealthController', () => {
  it('返回服务正常状态', () => {
    // 创建控制器实例，调用刚才编写的方法。
    const controller = new HealthController();
    const result = controller.check();

    // 如果返回值改变，测试会失败，提醒我们检查接口行为。
    expect(result).toEqual({ status: 'ok' });
  });
})