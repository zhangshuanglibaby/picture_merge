// Node.js 自带的文件系统模块。
// existsSync 用来检查临时目录是否存在，供测试断言使用。
import { existsSync } from 'node:fs';

// Node.js 自带的异步文件系统模块。
// writeFile 用来写一份测试文件，检查清理时会不会把文件一起删除。
import { writeFile } from 'node:fs/promises';

// Node.js 自带的路径模块。
// join 用来组合临时目录路径和测试文件名。
import { join } from 'node:path';

// Vitest 是当前项目的测试框架。
// describe 用来组织测试，it 定义一项测试，expect 检查结果是否符合预期。
import { describe, expect, it } from 'vitest';

// 导入我们自己编写的函数，作为这份测试的对象。
// ESM 项目中的本地导入路径按当前工程约定使用 .js 后缀。
import { createUploadWorkspace } from './upload-workspace.js';


describe('上传临时目录', () => {
  it('每次创建不同目录，并能清理目录及其中的文件', async () => {
    const first = await createUploadWorkspace();
    const second = await createUploadWorkspace();

    try {
      // 两次请求不能共用同一个工作目录。
      expect(first.directory).not.toBe(second.directory);
      expect(existsSync(first.directory)).toBe(true);

      // 用一份无隐私的测试文件模拟上传图片。
      await writeFile(join(first.directory, 'sample.txt'), 'test');

      // 清理后，文件和所属目录都应消失。
      await first.cleanup();
      expect(existsSync(first.directory)).toBe(false);

      // 清理第一个目录不应影响第二个目录。
      expect(existsSync(second.directory)).toBe(true);
    } finally {
      // 即使上面的断言失败，也尽量清理测试创建的目录。
      await first.cleanup();
      await second.cleanup();
    }
  })
})