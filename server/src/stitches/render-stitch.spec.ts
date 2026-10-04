// 引入 Node.js 路径工具，定位已有的五张测试图片。
import { join } from 'node:path';
// 引入 Sharp，检查生成图片的尺寸和接缝像素。
import sharp from 'sharp';
// 引入 Vitest 的测试和断言工具。
import { expect, it } from 'vitest';
// 引入本步创建的多图拼接函数。
import { renderStitch } from './render-stitch.js';

const fixture = (name: string) =>
  join(process.cwd(), 'test', 'fixtures', name);

it('按计划拼接五张图片，得到 240 × 1350 的 PNG', async () => {
  const paths = [1, 2, 3, 4, 5].map((number) =>
    fixture(`mixed-${number}.png`),
  );

  // 第二、四张分别裁掉 80、70 行；其余图片不裁。
  const output = await renderStitch(paths, [0, 80, 0, 70, 0]);
  const metadata = await sharp(output).metadata();

  expect(metadata.format).toBe('png');
  expect(metadata.width).toBe(240);
  expect(metadata.height).toBe(1350);

  // 成品第 300 行，应是第二张原图的第 80 行。
  const seam = await sharp(output)
    .extract({ left: 0, top: 300, width: 240, height: 1 })
    .removeAlpha().raw().toBuffer();
  const expected = await sharp(paths[1])
    .extract({ left: 0, top: 80, width: 240, height: 1 })
    .removeAlpha().raw().toBuffer();

  expect(seam.equals(expected)).toBe(true);
});

it('拒绝裁掉第二张全部内容', async () => {
  await expect(
    renderStitch(
      [fixture('mixed-1.png'), fixture('mixed-2.png')],
      [0, 300],
    ),
  ).rejects.toThrow('裁切计划中的行数无效');
});