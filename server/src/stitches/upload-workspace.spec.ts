// Node.js 自带的文件系统模块。
// existsSync 用来检查临时目录是否存在，供测试断言使用。
import { existsSync } from 'node:fs';

// Node.js 自带的异步文件系统模块。
// rm 用于测试结束后的真实兜底清理；writeFile 用于创建测试文件。
import { rm as removeDirectoryOnTestEnd, writeFile } from 'node:fs/promises';

// Node.js 自带的路径模块。
// join 用来组合临时目录路径和测试文件名。
import { join } from 'node:path';

// Vitest 是当前项目的测试框架。
// describe 用来组织测试，it 定义一项测试，expect 检查结果是否符合预期。vi 用来创建可控的删除函数模拟。
import { describe, expect, it, vi } from 'vitest';

// 同时导入删除函数类型，保证测试模拟函数的参数类型正确。
import {
  createUploadWorkspace,
  type RemoveUploadWorkspace,
} from './upload-workspace.js';


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

  it('删除失败两次后第三次成功时会重试并完成清理', async () => {
    let attempts = 0;

    // 模拟前两次删除失败，第三次调用真实 rm 删除目录。
    const removeDirectory = vi.fn<RemoveUploadWorkspace>(
      async (directory, options) => {
        attempts += 1;

        if (attempts < 3) {
          throw new Error('模拟删除失败');
        }

        await removeDirectoryOnTestEnd(directory, options);
      },
    );

    const workspace = await createUploadWorkspace({ removeDirectory });

    try {
      await workspace.cleanup();

      // 前两次失败后，第三次应该成功。
      expect(removeDirectory).toHaveBeenCalledTimes(3);
      expect(existsSync(workspace.directory)).toBe(false);
    } finally {
      // 如果断言提前失败，仍然清理测试目录。
      await removeDirectoryOnTestEnd(workspace.directory, {
        recursive: true,
        force: true,
      });
    }
  });

  it('删除连续失败三次时抛出最后一次异常', async () => {
    let attempts = 0;

    const firstError = new Error('第一次删除失败');
    const secondError = new Error('第二次删除失败');
    const lastError = new Error('第三次删除失败');

    // 模拟删除连续失败三次，验证清理逻辑不会无限重试。
    const removeDirectory = vi.fn<RemoveUploadWorkspace>(async () => {
      attempts += 1;

      if (attempts === 1) throw firstError;
      if (attempts === 2) throw secondError;
      throw lastError;
    });

    const workspace = await createUploadWorkspace({ removeDirectory });

    try {
      // 三次都失败后，应抛出最后一次删除异常。
      await expect(workspace.cleanup()).rejects.toBe(lastError);

      // 最多只能尝试三次。
      expect(removeDirectory).toHaveBeenCalledTimes(3);
    } finally {
      // 模拟删除函数不会真正删除目录，因此测试结束时用真实 rm 清理。
      await removeDirectoryOnTestEnd(workspace.directory, {
        recursive: true,
        force: true,
      });
    }
  });
})