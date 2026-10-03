/**
 * 配置“上传文件保存到哪里、叫什么名字、最多允许多大”
 */

// 从 Node.js 内置加密模块取得随机 UUID，给上传文件生成不重复的名字。
import { randomUUID } from 'node:crypto';

// 引入 Express 的请求类型，方便读取上一步拦截器放进请求的工作目录。
import type { Request } from 'express';

// 引入 Multer 的磁盘存储工具，让文件直接写入临时目录。
import { diskStorage } from 'multer';


// 引入已有的上传限制配置，避免在这里重复写限制数字。
import { IMAGE_LIMITS } from '../config/image-limits.js';

// 引入已有函数，仅用于推导工作目录对象的 TypeScript 类型。
import type { createUploadWorkspace } from './upload-workspace.js';

// 在普通请求类型上补充我们自己添加的 uploadWorkspace 属性。
type WorkspaceRequest = Request & {
  uploadWorkspace?: Awaited<ReturnType<typeof createUploadWorkspace>>;
};

// 导出配置，下一步再交给 NestJS 的文件上传拦截器使用。
export const stitchUploadOptions = {
  storage: diskStorage({
   //  diskStorage 允许分别指定目标目录和文件名
    destination(request: Request, _file, callback) {
      // 上一步的拦截器会先创建独立目录，并把它放在请求对象上。
      const workspace = (request as WorkspaceRequest).uploadWorkspace;

      if (!workspace) {
        // 如果目录不存在，立即拒绝写入，避免文件落到意料之外的位置。
        callback(new Error('上传工作目录尚未创建'), '');
        return;
      }

      // 告诉 Multer：当前请  求的文件应写入这个临时目录。
      callback(null, workspace.directory);
    },
    filename(_request, _file, callback) {
      // 不使用用户上传时提供的文件名，防止路径和重名问题。
      // 不加扩展名也可以：后续 Sharp 会读取文件内容识别图片格式。
      callback(null, randomUUID());
    },
  }),
  limits: {
    // 每张文件最多 15 MiB；使用已有配置中的实际数值。
    fileSize: IMAGE_LIMITS.maxFileBytes,
    // 一次请求最多接收配置允许的图片数量。
    files: IMAGE_LIMITS.maxImages,
    // 当前接口只接收图片文件，不接收额外文本字段。
    fields: 0,
    // multipart 中最多出现这么多个部分，进一步约束请求规模。
    parts: IMAGE_LIMITS.maxImages,
  },
}