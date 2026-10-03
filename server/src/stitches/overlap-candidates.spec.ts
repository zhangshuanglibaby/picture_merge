// 引入 Vitest 的分组、断言和测试用例工具。
import { describe, expect, it } from 'vitest';
// 引入灰度图类型，用数字构造便于理解的小图片。
import type { GrayImage } from './load-gray-image.js';
// 引入要测试的候选排序函数。
import { rankOverlapCandidates } from './overlap-candidates.js';

describe('rankOverlapCandidates', () => {
  it('把真正吻合的重叠 2 行排在最前面', () => {
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

    const results = rankOverlapCandidates(first, second, [1, 2, 3]);

    expect(results.map((item) => item.overlapRows)).toEqual([2, 1, 3]);
    expect(results.map((item) => item.score)).toEqual([0, 10, 10]);
  });

  it('大片相同颜色会使多个候选同时得到 0 分', () => {
    const flat: GrayImage = {
      width: 1,
      height: 3,
      pixels: new Uint8Array([200, 200, 200]),
    };

    const results = rankOverlapCandidates(flat, flat, [1, 2, 3]);

    // 三种高度看起来都“完全吻合”，仅靠最低分无法确定真实位置。
    expect(results.map((item) => item.score)).toEqual([0, 0, 0]);
  });

  it('没有候选高度时报错', () => {
    const image: GrayImage = {
      width: 1,
      height: 1,
      pixels: new Uint8Array([50]),
    };

    expect(() => rankOverlapCandidates(image, image, []))
      .toThrow('至少需要一个候选重叠行数');
  });
});