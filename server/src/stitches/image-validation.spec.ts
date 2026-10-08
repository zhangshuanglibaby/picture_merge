// Node.js 自带的 URL 模块；把测试图片的文件 URL 转成文件路径。
import { fileURLToPath } from 'node:url';

// 当前 ESM 工程的测试框架：组织测试并检查结果。
import { describe, expect, it } from 'vitest';

// 导入本步编写的校验函数。
import { validateImage } from './image-validation.js';

// 根据当前测试文件的位置，找到 server/test/fixtures 中的图片。
const fixture = (name: string) =>
  fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url));

describe('图片基础校验', () => {
  it('接受提供的三张手机照片', async () => {
    for (const name of ['IMG_7698.JPG', 'IMG_7704.JPG', 'IMG_7707.jpg']) {
      await expect(validateImage(fixture(name))).resolves.toMatchObject({
        format: 'jpeg',
      });
    }
  });

  it('接受真正的 PNG，并读取尺寸', async () => {
    await expect(validateImage(fixture('overlap-1.png'))).resolves.toEqual({
      format: 'png',
      width: 240,
      height: 320,
    });
  });

  it('拒绝伪装成 PNG 的文本文件', async () => {
    await expect(validateImage(fixture('invalid.png'))).rejects.toThrow(
      '图片无法读取',
    );
  });
});
