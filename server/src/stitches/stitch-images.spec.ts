// 引入 Node.js 路径工具，定位项目已有的测试图片。
import { join } from 'node:path';
// 引入 Sharp，读取成品 PNG 的格式和尺寸。
import sharp from 'sharp';
// 引入 Vitest 的测试与断言工具。
import { expect, it } from 'vitest';
// 引入本步创建的完整拼接流程。
import { stitchImages } from './stitch-images.js';

// 把测试图片的文件名转换为完整路径。
const fixture = (name: string) =>
  join(process.cwd(), 'test', 'fixtures', name);

it('自动识别并拼接两张明确重叠的图片', async () => {
  const result = await stitchImages([
    fixture('overlap-1.png'),
    fixture('overlap-2.png'),
  ]);
  const metadata = await sharp(result.png).metadata();

  expect(result.cropTopPx).toEqual([0, 100]);
  expect(result.unconfirmedImageIndices).toEqual([]);
  expect(metadata.format).toBe('png');
  expect(metadata.height).toBe(540);
});

it('自动拼接五张，并保留无法确认的位置记录', async () => {
  const paths = [1, 2, 3, 4, 5].map((number) =>
    fixture(`mixed-${number}.png`),
  );
  const result = await stitchImages(paths);
  const metadata = await sharp(result.png).metadata();

  // 第三、五张无法确认重叠，因此没有裁掉它们的内容。
  expect(result.cropTopPx).toEqual([0, 80, 0, 70, 0]);
  expect(result.unconfirmedImageIndices).toEqual([2, 4]);
  expect(metadata.width).toBe(240);
  expect(metadata.height).toBe(1350);
});

it('相似页眉不自动裁切，并标记为无法确认', async () => {
  const result = await stitchImages([
    fixture('header-1.png'),
    fixture('header-2.png'),
  ]);
  const metadata = await sharp(result.png).metadata();

  expect(result.cropTopPx).toEqual([0, 0]);
  expect(result.unconfirmedImageIndices).toEqual([1]);
  expect(metadata.height).toBe(600);
});