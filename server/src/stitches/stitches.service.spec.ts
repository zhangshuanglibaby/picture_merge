import { describe, expect, it } from 'vitest';
// Node.js 自带的异步文件模块；stat 读取测试图片的真实字节数。
import { stat } from 'node:fs/promises';
// Node.js 自带的 URL 模块；把测试素材的位置转成文件路径。
import { fileURLToPath } from 'node:url';

// 导入待测服务。
import { StitchesService } from './stitches.service.js';
// 导入业务错误。
import { StitchError } from './stitch.error.js';

// 读取与正式代码相同的整组大小限制。
import { IMAGE_LIMITS } from '../config/image-limits.js';


describe('StitchesService：图片数量', () => {
  // 直接创建服务，测试它的数量判断，不需要启动 HTTP 服务。
  const service = new StitchesService();

  it.each([2, 3, 5])('接受 %i 张图片', (count) => {
    expect(() => service.validateImageCount(count)).not.toThrow();
  });

  it.each([0, 1, 6, 1.5])('拒绝 %s 张图片', (count) => {
    expect(() => service.validateImageCount(count)).toThrow(StitchError);
  });

  it('按传入顺序校验并保留两张图片', async () => {
    // 从现有素材目录找到两张不重叠的 PNG。
    const paths = ['plain-1.png', 'plain-2.png'].map((name) =>
      fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url)),
    );
    const files = await Promise.all(
      paths.map(async (path) => ({ path, size: (await stat(path)).size })),
    );

    const result = await service.validateImages(files);

    // 校验后仍按第一张、第二张的原顺序排列。
    expect(result.map((image) => image.path)).toEqual(paths);
  });

  it('拒绝整组图片总量超限', async () => {
    const path = fileURLToPath(
      new URL('../../test/fixtures/plain-1.png', import.meta.url),
    );

    // 用模拟的上传字节数专门测试“整组累计大小”规则。
    const files = Array.from({ length: 4 }, () => ({
      path,
      size: IMAGE_LIMITS.maxFileBytes,
    }));

    await expect(service.validateImages(files)).rejects.toThrow(
      '本次上传总大小超出限制',
    );
  });
});


