// 引入 Vitest 的分组、断言和测试用例工具。
import { describe, expect, it } from 'vitest';
// 引入刚写好的候选行数生成函数。
import { createOverlapRowsToTry } from './overlap-rows.js';


describe('createOverlapRowsToTry', () => {
  it('小图片会尝试每一种可能的重叠行数', () => {
    // 两张图分别高 5 行和 4 行，最多只能重叠 4 行。
    expect(createOverlapRowsToTry(5, 4)).toEqual([1, 2, 3, 4]);
  });

  it('大图片最多生成 256 个均匀分布的候选', () => {
    const rows = createOverlapRowsToTry(1200, 1000);

    expect(rows).toHaveLength(256);
    expect(rows[0]).toBe(1);
    expect(rows[rows.length - 1]).toBe(1000);
    // 候选从小到大排列，且没有重复行数。
    expect(new Set(rows).size).toBe(rows.length);
  });

  it('拒绝无效图片高度', () => {
    expect(() => createOverlapRowsToTry(0, 100))
      .toThrow('图片高度必须是正整数');
  });
});