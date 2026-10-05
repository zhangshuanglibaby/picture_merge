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

  it('图片处理超时返回 504 和专用错误码', () => {
    // 创建一个图片处理超时异常。
    const error = new StitchError(
      'PROCESSING_TIMEOUT',
      '图片处理超时，请稍后重试',
    );

    // 504 表示服务端等待上游处理超时。
    expect(error.getStatus()).toBe(504);

    // 检查前端可识别的错误码和提示。
    expect(error.getResponse()).toEqual({
      code: 'PROCESSING_TIMEOUT',
      message: '图片处理超时，请稍后重试',
    });
  });
});
