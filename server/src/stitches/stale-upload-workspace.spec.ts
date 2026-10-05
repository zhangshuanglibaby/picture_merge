// 检查目录是否还存在。
import { existsSync } from 'node:fs';

// 创建临时测试目录、子目录、文件时间和删除测试目录。
import {
  mkdir,
  mkdtemp,
  rm,
  utimes,
} from 'node:fs/promises';

// 获取系统临时目录。
import { tmpdir } from 'node:os';

// 拼接测试目录路径。
import { join } from 'node:path';

// Vitest 测试工具。
import { afterEach, describe, expect, it } from 'vitest';

// 导入待测试的遗留目录清扫函数。
import { cleanupStaleUploadWorkspaces } from './stale-upload-workspace.js';

describe('遗留上传工作区清扫', () => {
  let testRoot = '';

  afterEach(async () => {
    // 每个测试结束后删除自己的测试根目录。
    if (testRoot) {
      await rm(testRoot, {
        recursive: true,
        force: true,
      });
    }
  });

  it('只删除过期的 image-stitch- 工作区', async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'stale-workspace-test-'));

    const oldWorkspace = join(testRoot, 'image-stitch-old');
    const freshWorkspace = join(testRoot, 'image-stitch-fresh');
    const unrelatedDirectory = join(testRoot, 'other-directory');

    await mkdir(oldWorkspace);
    await mkdir(freshWorkspace);
    await mkdir(unrelatedDirectory);

    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1_000);

    // 把旧工作区的修改时间设置为一小时前。
    await utimes(oldWorkspace, oneHourAgo, oneHourAgo);

    const removedCount = await cleanupStaleUploadWorkspaces({
      rootDirectory: testRoot,
      maxAgeMs: 30 * 60 * 1_000,
      now,
    });

    // 只有旧的 image-stitch- 目录应该被删除。
    expect(removedCount).toBe(1);
    expect(existsSync(oldWorkspace)).toBe(false);

    // 新目录和其他名称的目录都不能被误删。
    expect(existsSync(freshWorkspace)).toBe(true);
    expect(existsSync(unrelatedDirectory)).toBe(true);
  });
});