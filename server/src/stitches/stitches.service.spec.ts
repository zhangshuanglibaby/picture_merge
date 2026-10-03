import { describe, expect, it } from 'vitest';
import { StitchesService } from './stitches.service.js';
import { StitchError } from './stitch.error.js';

describe('StitchesService：图片数量', () => {
  // 直接创建服务，测试它的数量判断，不需要启动 HTTP 服务。
  const service = new StitchesService();

  it.each([2, 3, 5])('接受 %i 张图片', (count) => {
    expect(() => service.validateImageCount(count)).not.toThrow();
  });

  it.each([0, 1, 6, 1.5])('拒绝 %s 张图片', (count) => {
    expect(() => service.validateImageCount(count)).toThrow(StitchError);
  });
});