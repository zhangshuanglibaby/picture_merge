/**
 * 新增多种样例变成自动测试
 */

// 引入 Node.js 的路径拼接函数，用来找到测试图片。
import { join } from 'node:path';
// 引入 Vitest：it 定义测试，expect 检查识别结果。
import { expect, it } from 'vitest';
// 引入现有函数，把图片读取成用于比较的灰度像素。
import { loadGrayImage } from '../src/stitches/load-gray-image.js';
// 引入现有的候选搜索和“只接受可靠重叠”的判断函数。
import {
  chooseExactOverlapOrNull,
  findOverlapCandidates,
} from '../src/stitches/overlap-candidates.js';
// 引入现有的打分函数，检查指定重叠行数本身能得到多少分。
import { calculateOverlapScore } from '../src/stitches/overlap-score.js';

// 每一项表示一对相邻图片，以及当前希望识别出的重叠行数。
// null 表示“没有足够证据裁切”，不能把它理解成已证明两图绝不重叠。
const cases: Array<{
  name: string;
  first: string;
  second: string;
  expected: number | null;
}> = [
    { name: '明确重叠 100 行', first: 'overlap-1.png', second: 'overlap-2.png', expected: 100 },
    { name: '相邻但不重叠', first: 'plain-1.png', second: 'plain-2.png', expected: null },
    { name: '五张中的第 1、2 张重叠 80 行', first: 'mixed-1.png', second: 'mixed-2.png', expected: 80 },
    { name: '五张中的第 2、3 张不重叠', first: 'mixed-2.png', second: 'mixed-3.png', expected: null },
    { name: '五张中的第 3、4 张重叠 70 行', first: 'mixed-3.png', second: 'mixed-4.png', expected: 70 },
    { name: '五张中的第 4、5 张不重叠', first: 'mixed-4.png', second: 'mixed-5.png', expected: null },
    { name: '只有相似页眉，不应裁切正文', first: 'header-1.png', second: 'header-2.png', expected: null },
  ];


// 为每一对图片单独创建测试，失败时能直接看到是哪种场景出了问题。
for (const item of cases) {
  it(item.name, async () => {
    // 图片均来自项目现有的 test/fixtures 目录。
    const firstPath = join(process.cwd(), 'test', 'fixtures', item.first);
    const secondPath = join(process.cwd(), 'test', 'fixtures', item.second);

    // 分别读取两张图片；await 表示等图片读取完成再继续。
    const first = await loadGrayImage(firstPath);
    const second = await loadGrayImage(secondPath);

    // 先找候选位置，再逐像素复核最有希望的候选。
    const candidates = findOverlapCandidates(first, second);
    const actual = chooseExactOverlapOrNull(first, second, candidates);

    // 目前只调查两个失败场景，避免其他测试的输出干扰阅读。
    if (
      item.name === '五张中的第 1、2 张重叠 80 行' ||
      item.name === '只有相似页眉，不应裁切正文'
    ) {
      // 前者检查真正的 80 行；后者检查被误选的 40 行。
      const rowsToInspect = item.expected ?? 40;

      console.log(item.name, {
        // 直接计算该行数的分数，判断图片内容是否真的吻合。
        directScore: calculateOverlapScore(first, second, rowsToInspect),
        // 查看候选搜索有没有把该行数找出来。
        candidate: candidates.find((candidate) => candidate.overlapRows === rowsToInspect),
        // 查看最后的判断函数有没有接受它。
        chosenRows: actual,
      });

      // 打印排名前十的位置，检查是否有多个候选同时得到 0 分。
      console.table(candidates.slice(0, 10));
    }

    // 对比测试素材规定的重叠行数。
    expect(actual).toBe(item.expected);
  }, 30_000);
}