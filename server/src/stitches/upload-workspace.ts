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



/**
 * 创建一个唯一的临时工作目录，用于存放上传的图片。
 * 
 * 返回目录路径，处理结束后需要调用 rm() 删除。
 */
export async function createUploadWorkspace() {

  // 在系统临时目录下创建唯一文件夹。
  // Node.js 会在 image-stitch- 后面追加随机字符，避免不同请求使用同一目录。
  const directory = await mkdtemp(join(tmpdir(), 'image-stitch-'));

  return {
    // 后续上传步骤会把本次请求的图片存放到这里。
    directory,

    // 只删除上面刚创建的目录，不接收外部传入的删除路径。
    async cleanup(): Promise<void> {
      // recursive 删除目录及其中的文件；force 允许重复清理。
      await rm(directory, { recursive: true, force: true });
    },
  };

}
