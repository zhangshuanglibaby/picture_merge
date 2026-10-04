
/**
 * 检查现有图片上的实际识别结果
 */

// 引入 Node.js 路径工具，定位 server/test/fixtures 下的图片。
import { join } from 'node:path';
// 引入 Vitest 的测试和基本断言工具。
import { expect, it } from 'vitest';
// 引入图片转换函数，将文件变为单通道灰度像素。
import { loadGrayImage } from '../src/stitches/load-gray-image.js';
// 引入候选搜索与“不确定就不选”的判断函数。
import {
  chooseExactOverlapOrNull,
  findOverlapCandidates,
} from '../src/stitches/overlap-candidates.js';


it('打印一组截图的重叠识别结果（诊断用）', async () => {
  // 第一张在前、第二张在后；文件名须与现有测试素材一致。
  const firstPath = join(process.cwd(), 'test/fixtures/overlap-1.png');
  const secondPath = join(process.cwd(), 'test/fixtures/overlap-2.png');

  // 依次解码成灰度像素，供已有的比较函数使用。
  const first = await loadGrayImage(firstPath);
  const second = await loadGrayImage(secondPath);

  console.log('两张图的尺寸：', {
    first: `${first.width} × ${first.height}`,
    second: `${second.width} × ${second.height}`,
  });

  // 当前算法要求两张图宽度相同，否则不能逐列比较。
  expect(first.width).toBe(second.width);

  // 粗筛、精查，再查看分数最好的几个候选位置。
  const candidates = findOverlapCandidates(first, second);
  expect(candidates.length).toBeGreaterThan(0);

  console.log('分数最好的五个候选：');
  console.table(candidates.slice(0, 5));

  // 全像素复核后，才允许把候选行数交给后续裁切步骤。
  const chosenRows = chooseExactOverlapOrNull(first, second, candidates);

  // 这是 cases.json 对这组测试图片给出的预期结果。
  expect(chosenRows).toBe(100);
  expect(first.height + second.height - chosenRows!).toBe(540);
  console.log('最终是否选择：', chosenRows ?? '无法确定');
}, 30_000);
