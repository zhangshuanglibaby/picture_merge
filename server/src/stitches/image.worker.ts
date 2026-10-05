// 引入现有的图片拼接主流程。
// worker 会在这里调用归一化、重叠识别和 PNG 合成。
import {
  stitchImages,
  type StitchResult,
} from './stitch-images.js';


// 描述主线程传给 worker 的数据。
export type StitchWorkerInput = {
  // 已经上传到临时目录中的图片路径。
  paths: readonly string[];

  // 当前请求专属的临时工作目录。
  // normalizeImages 会把中间图片写入这里。
  workspaceDirectory: string;
};


// 这是 Piscina 实际执行的 worker 函数。
// 主线程提交 StitchWorkerInput，worker 返回 StitchResult。
export default async function runStitch(
  input: StitchWorkerInput,
): Promise<StitchResult> {
  // 在 worker 内执行现有的图片拼接流程。
  return stitchImages(
    input.paths,
    input.workspaceDirectory,
  );
}