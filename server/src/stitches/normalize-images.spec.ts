// 引入 Node.js 路径工具，定位现有测试图片。
import { join } from 'node:path';
// 引入 Sharp，读取预处理后的图片尺寸。
import sharp from 'sharp';
// 引入 Vitest 的测试和断言工具。
import { expect, it } from 'vitest';
// 引入现有的临时目录工具，测试结束后清理生成的文件。
import { createUploadWorkspace } from './upload-workspace.js';
// 引入本步创建的图片预处理函数。
import { normalizeImages } from './normalize-images.js';
import { IMAGE_LIMITS } from '../config/image-limits.js';

it('将不同宽度的图片统一为 240 像素宽', async () => {
  const workspace = await createUploadWorkspace();

  try {
    // 第一张原本是 320 × 300，第二张是 240 × 300。
    const paths = [
      join(process.cwd(), 'test/fixtures/width-1.png'),
      join(process.cwd(), 'test/fixtures/width-2.png'),
    ];

    const normalized = await normalizeImages(paths, workspace.directory);
    const first = await sharp(normalized[0]).metadata();
    const second = await sharp(normalized[1]).metadata();

    // 第一张等比缩小后高 225；第二张不需要放大。
    expect(normalized).toHaveLength(2);
    expect([first.width, first.height]).toEqual([240, 225]);
    expect([second.width, second.height]).toEqual([240, 300]);
  } finally {
    // 即使断言失败，也删除本次测试产生的临时文件。
    await workspace.cleanup();
  }
});

it('大照片按无重叠的总输出预算缩小，仍保持等宽', async () => {
  const workspace = await createUploadWorkspace();
  try {
    const names = ['IMG_7698.JPG', 'IMG_7704.JPG', 'IMG_7707.jpg'];
    const normalized = await normalizeImages(
      names.map((name) => join(process.cwd(), 'test/fixtures', name)),
      workspace.directory,
    );
    const sizes = await Promise.all(normalized.map((path) => sharp(path).metadata()));
    const width = sizes[0].width!;
    const height = sizes.reduce((sum, size) => sum + size.height!, 0);

    expect(width).toBeLessThan(3128);
    expect(sizes.every((size) => size.width === width)).toBe(true);
    expect(height).toBeLessThanOrEqual(IMAGE_LIMITS.maxOutputHeight);
    expect(width * height).toBeLessThanOrEqual(IMAGE_LIMITS.maxOutputPixels);
  } finally {
    await workspace.cleanup();
  }
});
