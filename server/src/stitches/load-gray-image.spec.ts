// 引入 Node.js 路径工具，用于定位已有的测试图片。
import { join } from 'node:path';
// 引入 Vitest 的测试与断言工具。
import { describe, expect, it } from 'vitest';
// 引入刚写好的图片转换函数。
import { loadGrayImage } from './load-gray-image.js';


describe('loadGrayImage', () => {
  it('将有效图片转换为每像素一个灰度值', async () => {
    // 测试命令从 server 目录执行，所以从这里定位图片。
    const path = join(process.cwd(), 'test/fixtures/overlap-1.png');
    const image = await loadGrayImage(path);

    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
    // 宽 × 高就是像素个数；单通道时也是数组长度。
    expect(image.pixels.length).toBe(image.width * image.height);
  });

  it('无法解码的文件会报错', async () => {
    const path = join(process.cwd(), 'test/fixtures/invalid.png');

    await expect(loadGrayImage(path)).rejects.toThrow();
  });
});