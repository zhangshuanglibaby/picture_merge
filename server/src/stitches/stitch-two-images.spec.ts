// 引入 Node.js 路径工具，定位现有测试图片。
import { join } from 'node:path';
// 引入 Sharp，检查输出 PNG 的尺寸和接缝处的像素。
import sharp from 'sharp';
// 引入 Vitest 的测试和断言工具。
import { describe, expect, it } from 'vitest';
// 引入刚写好的两图拼接函数。
import { stitchTwoImages } from './stitch-two-images.js';

const first = join(process.cwd(), 'test/fixtures/overlap-1.png');
const second = join(process.cwd(), 'test/fixtures/overlap-2.png');

describe('stitchTwoImages', () => {
  it('按重叠 100 行拼出 240 × 540 的 PNG', async () => {
    const output = await stitchTwoImages(first, second, 100);
    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(240);
    expect(metadata.height).toBe(540);

    // 输出的第 320 行，应当来自第二张图片的第 100 行。
    const actual = await sharp(output)
      .extract({ left: 0, top: 320, width: 240, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer();
    const expected = await sharp(second)
      .extract({ left: 0, top: 100, width: 240, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer();

    expect(actual.equals(expected)).toBe(true);
  });

  it('拒绝没有留下第二张内容的重叠高度', async () => {
    await expect(stitchTwoImages(first, second, 320))
      .rejects.toThrow('重叠行数无效');
  });



  it('重叠 0 行时完整保留两张图片', async () => {
    // 使用现有的两张不重叠图片。
    const plainFirst = join(process.cwd(), 'test/fixtures/plain-1.png');
    const plainSecond = join(process.cwd(), 'test/fixtures/plain-2.png');

    // 0 表示第二张不裁切，直接接在第一张后面。
    const output = await stitchTwoImages(plainFirst, plainSecond, 0);
    const metadata = await sharp(output).metadata();

    // 两张图片各高 320 行，所以总高度应为 640 行。
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(240);
    expect(metadata.height).toBe(640);

    // 检查接缝：成品第 320 行应等于第二张原图的第 0 行。
    const actual = await sharp(output)
      .extract({ left: 0, top: 320, width: 240, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer();
    const expected = await sharp(plainSecond)
      .extract({ left: 0, top: 0, width: 240, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer();

    expect(actual.equals(expected)).toBe(true);
  });
});