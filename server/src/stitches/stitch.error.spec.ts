import { describe, expect, it } from 'vitest';
import { StitchError } from './stitch.error.js';

// 检查错误码、提示文字和 HTTP 状态码没有配错。
describe('StitchError', () => {
  it('图片数量错误返回 400 和约定的 JSON 内容', () => {
    const error = new StitchError('INVALID_COUNT', '请选择 2～5 张图片');

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toEqual({
      code: 'INVALID_COUNT',
      message: '请选择 2～5 张图片',
    });
  });

  it('服务繁忙返回 503', () => {
    const error = new StitchError('BUSY', '服务繁忙，请稍后重试');

    expect(error.getStatus()).toBe(503);
  });
});
