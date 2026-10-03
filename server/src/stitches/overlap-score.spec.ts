// 引入 Vitest 的测试与断言工具。
import { describe, expect, it } from 'vitest';
// 引入灰度图类型，用很小的模拟图片编写测试。
import type { GrayImage } from './load-gray-image.js';
// 引入刚写好的候选重叠评分函数。
import { calculateOverlapScore } from './overlap-score.js';


// 每个数字代表一整行中的一个灰度像素，所以图片宽度都是 1 px。
const first: GrayImage = {
  width: 1,
  height: 5,
  pixels: new Uint8Array([10, 20, 30, 40, 50]),
};

const second: GrayImage = {
  width: 1,
  height: 4,
  pixels: new Uint8Array([40, 50, 60, 70]),
};

describe('calculateOverlapScore', () => {
  it('重叠 2 行时，底部 40、50 与顶部 40、50 完全相同', () => {
    expect(calculateOverlapScore(first, second, 2)).toBe(0);
  });

  it('假设只重叠 1 行时，50 与 40 不同', () => {
    expect(calculateOverlapScore(first, second, 1)).toBe(10);
  });

  it('重叠行数超过较短图片的高度时拒绝计算', () => {
    expect(() => calculateOverlapScore(first, second, 5))
      .toThrow('候选重叠行数无效');
  });
});