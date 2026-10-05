/**
 * 过期工作区清扫 helper
 */

// 读取临时目录中的条目，并删除遗留工作区。
import { readdir, rm, stat } from 'node:fs/promises';

// 获取系统临时目录。
import { tmpdir } from 'node:os';

// 安全拼接目录路径。
import { join } from 'node:path';

// 删除目录函数类型，便于测试时注入可控实现。
export type RemoveStaleWorkspace = (
  directory: string,
  options: { recursive: true; force: true },
) => Promise<void>;

// 所有上传工作区都必须使用这个前缀。
const UPLOAD_WORKSPACE_PREFIX = 'image-stitch-';

// 默认只清理超过 24 小时的目录。
const DEFAULT_STALE_AGE_MS = 24 * 60 * 60 * 1_000;


/**
 * 清理过期上传工作区
 * @param options - 清理选项
 * @returns 实际删除的目录数量
 */
export async function cleanupStaleUploadWorkspaces(
  options: {
    // 生产环境默认扫描系统临时目录。
    rootDirectory?: string;

    // 允许调用方调整“多久算遗留目录”。
    maxAgeMs?: number;

    // 测试时固定当前时间，避免测试结果随时间变化。
    now?: number;

    // 生产环境使用 rm，测试时可以注入模拟函数。
    removeDirectory?: RemoveStaleWorkspace;
  } = {},
): Promise<number> {
  const rootDirectory = options.rootDirectory ?? tmpdir();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_STALE_AGE_MS;
  const now = options.now ?? Date.now();
  const removeDirectory = options.removeDirectory ?? rm;

  // 早于这个时间点的目录才可能是遗留目录。
  const staleBefore = now - maxAgeMs;

  // 只读取临时目录的第一层，不递归扫描其他用户目录。
  const entries = await readdir(rootDirectory, {
    withFileTypes: true,
  });

  let removedCount = 0;

  for (const entry of entries) {
    // 只处理目录，并且必须匹配本项目自己的命名前缀。
    if (
      !entry.isDirectory() ||
      !entry.name.startsWith(UPLOAD_WORKSPACE_PREFIX)
    ) {
      continue;
    }

    const directory = join(rootDirectory, entry.name);
    const information = await stat(directory);

    // 较新的目录可能仍属于正常请求，不能删除。
    if (information.mtimeMs >= staleBefore) {
      continue;
    }

    // 只删除确认过期的本项目工作区。
    await removeDirectory(directory, {
      recursive: true,
      force: true,
    });

    removedCount += 1;
  }

  // 返回实际删除的目录数量，方便日志和测试确认。
  return removedCount;
}