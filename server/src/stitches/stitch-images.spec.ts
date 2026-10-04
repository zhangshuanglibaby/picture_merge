// 引入 Node.js 路径工具，定位项目已有的测试图片。
import { join } from 'node:path';
// 引入 Sharp，读取成品 PNG 的格式和尺寸。
import sharp from 'sharp';
// 引入 Vitest 的测试与断言工具。
import { expect, it } from 'vitest';
// 引入本步创建的完整拼接流程。
import { stitchImages } from './stitch-images.js';
// 引入临时工作目录工具，保存预处理后的图片。
import { createUploadWorkspace } from './upload-workspace.js';

// 把测试图片的文件名转换为完整路径。
const fixture = (name: string) =>
  join(process.cwd(), 'test', 'fixtures', name);

it('自动识别并拼接两张明确重叠的图片', async () => {
  // 创建本次测试专用的临时目录。
  const workspace = await createUploadWorkspace();

  try {
    const result = await stitchImages(
      [
        fixture('overlap-1.png'),
        fixture('overlap-2.png'),
      ],
      workspace.directory,
    );

    const metadata = await sharp(result.png).metadata();

    expect(result.cropTopPx).toEqual([0, 100]);
    expect(result.unconfirmedImageIndices).toEqual([]);
    expect(metadata.format).toBe('png');
    expect(metadata.height).toBe(540);
  } finally {
    // 无论测试成功还是失败，都删除临时文件。
    await workspace.cleanup();
  }
});

it('自动拼接五张，并保留无法确认的位置记录', async () => {

  const workspace = await createUploadWorkspace();

  const paths = [1, 2, 3, 4, 5].map((number) =>
    fixture(`mixed-${number}.png`),
  );
  try {
    const result = await stitchImages(paths, workspace.directory);

    const metadata = await sharp(result.png).metadata();

    // 第三、五张无法确认重叠，因此没有裁掉它们的内容。
    expect(result.cropTopPx).toEqual([0, 80, 0, 70, 0]);
    expect(result.unconfirmedImageIndices).toEqual([2, 4]);
    expect(metadata.width).toBe(240);
    expect(metadata.height).toBe(1350);
  } finally {
    await workspace.cleanup();
  }

});

it('相似页眉不自动裁切，并标记为无法确认', async () => {

  const workspace = await createUploadWorkspace();

  try {
    const result = await stitchImages([
      fixture('header-1.png'),
      fixture('header-2.png'),
    ], workspace.directory);

    const metadata = await sharp(result.png).metadata();

    expect(result.cropTopPx).toEqual([0, 0]);
    expect(result.unconfirmedImageIndices).toEqual([1]);
    expect(metadata.height).toBe(600);
  } finally {
    await workspace.cleanup();
  }
});

it('自动统一不同宽度后再拼接', async () => {
  // 创建本次测试专用的临时目录。
  const workspace = await createUploadWorkspace();

  try {
    // 第一张原始宽度为 320，第二张原始宽度为 240。
    const result = await stitchImages(
      [
        fixture('width-1.png'),
        fixture('width-2.png'),
      ],
      workspace.directory,
    );

    const metadata = await sharp(result.png).metadata();

    // 两张图片会统一为 240 像素宽。
    expect(metadata.width).toBe(240);

    // 第一张缩放后高度为 225，第二张高度为 300。
    // 两张图片没有确认的重叠，所以总高度为 225 + 300。
    expect(metadata.height).toBe(525);

    // 没有确认重叠时，暂时不裁掉第二张内容。
    expect(result.cropTopPx).toEqual([0, 0]);
    expect(result.unconfirmedImageIndices).toEqual([1]);
  } finally {
    // 清理预处理生成的 PNG 文件。
    await workspace.cleanup();
  }
});