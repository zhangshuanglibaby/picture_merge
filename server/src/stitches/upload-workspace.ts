/**
 * 准备上传图片的临时工作目录。每次处理使用不同目录，完成后删除
 */

// fs/promises 是 Node.js 的文件系统模块，提供可用 await 调用的文件操作。
// mkdtemp 用来创建名称唯一的临时目录；rm 用来在处理结束后删除它。
import { mkdtemp, rm } from 'node:fs/promises';

// os 是 Node.js 的操作系统模块；tmpdir() 获取系统临时目录的位置。
import { tmpdir } from 'node:os';

// path 用来安全地组合路径；join() 把临时目录和文件夹名称拼在一起。
import { join } from 'node:path';

// 删除工作区的函数类型，方便测试时注入可控的删除行为。
export type RemoveUploadWorkspace = (
  directory: string,
  options: { recursive: true; force: true },
) => Promise<void>;

// 最多尝试 3 次，避免删除失败后无限重试。
const CLEANUP_MAX_ATTEMPTS = 3;



/**
 * 创建一个唯一的临时工作目录，用于存放上传的图片。
 * 
 * 返回目录路径，处理结束后需要调用 rm() 删除。
 */
export async function createUploadWorkspace(
  options: {
    // 生产环境默认使用 Node.js 的 rm；测试时可以注入模拟函数。
    removeDirectory?: RemoveUploadWorkspace;
  } = {},
) {

  const removeDirectory = options.removeDirectory ?? rm;

  // 在系统临时目录下创建唯一文件夹。
  // Node.js 会在 image-stitch- 后面追加随机字符，避免不同请求使用同一目录。
  const directory = await mkdtemp(join(tmpdir(), 'image-stitch-'));

  return {
    // 后续上传步骤会把本次请求的图片存放到这里。
    directory,

    // 只删除上面刚创建的目录，不接收外部传入的删除路径。
    async cleanup(): Promise<void> {
      // 保存最后一次删除失败的异常，3 次都失败时继续抛出它。
      let lastError: unknown;

      // 删除失败时最多重试 3 次。
      for (let attempt = 1; attempt <= CLEANUP_MAX_ATTEMPTS; attempt += 1) {
        try {
          // 递归删除目录及其中的文件；force 允许目录已不存在。
          await removeDirectory(directory, {
            recursive: true,
            force: true,
          });

          // 删除成功后立即结束，不再重复调用。
          return;
        } catch (error) {
          // 记录本次异常，下一轮继续尝试。
          lastError = error;
        }
      }

      // 3 次都失败时，把最后一次异常交给上层处理。
      throw lastError;
    }
  };

}
