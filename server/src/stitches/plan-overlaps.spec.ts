// 引入 Node.js 路径工具，定位测试图片。
import { join } from 'node:path';
// 引入 Vitest 测试与断言工具。
import { expect, it } from 'vitest';
// 引入刚完成的裁切计划函数。
import { planOverlaps } from './plan-overlaps.js';

// 把文件名转换为测试图片的完整路径。
const fixture = (name: string) =>
  join(process.cwd(), 'test', 'fixtures', name);

it('两张图片识别出第二张顶部重叠 100 行', async () => {
  const result = await planOverlaps([
    fixture('overlap-1.png'),
    fixture('overlap-2.png'),
  ]);

  expect(result).toEqual([0, 100]);
});


it('五张图片按顺序记录重叠与无法确认的位置', async () => {
  const result = await planOverlaps([
    fixture('mixed-1.png'),
    fixture('mixed-2.png'),
    fixture('mixed-3.png'),
    fixture('mixed-4.png'),
    fixture('mixed-5.png'),
  ]);

  expect(result).toEqual([0, 80, null, 70, null]);
});