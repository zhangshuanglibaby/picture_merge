// 引入 Vitest 的测试分组、断言和测试用例工具。
import { describe, expect, it } from 'vitest';
// 引入刚写好的逐行比较函数。
import { calculateRowDifference } from './row-difference.js';

describe('calculateRowDifference', () => {
  it('完全相同的两行返回 0', () => {
    const pixels = new Uint8Array([10, 20, 30]);

    expect(calculateRowDifference(pixels, pixels, 3, 0, 0)).toBe(0);
  });

  it('返回每个像素差值的平均值', () => {
    const first = new Uint8Array([0, 100, 200]);
    const second = new Uint8Array([0, 110, 180]);

    // 三个位置分别相差 0、10、20，平均值是 10。
    expect(calculateRowDifference(first, second, 3, 0, 0)).toBe(10);
  });

  it('可以比较不同的行', () => {
    const first = new Uint8Array([0, 0, 200, 200]);
    const second = new Uint8Array([200, 200, 0, 0]);

    // 每行两个像素：第一张的第 1 行等于第二张的第 0 行。
    expect(calculateRowDifference(first, second, 2, 1, 0)).toBe(0);
  });

  it('行号超出范围时明确报错', () => {
    const pixels = new Uint8Array([10, 20]);

    expect(() => calculateRowDifference(pixels, pixels, 2, 1, 0))
      .toThrow('要比较的行超出了图片范围');
  });
});