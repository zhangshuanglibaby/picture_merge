// 引入现有的图片拼接主流程。
import {
  stitchImages,
  type StitchResult,
} from './stitch-images.js';

// 引入业务错误类型，用来识别可预期的图片处理错误。
import {
  StitchError,
  type StitchErrorCode,
} from './stitch.error.js';

// 描述主线程传给 worker 的数据。
export type StitchWorkerInput = {
  // 已经上传到临时目录中的图片路径。
  paths: readonly string[];

  // 当前请求专属的临时工作目录。
  workspaceDirectory: string;
};

// 描述 worker 成功时返回的数据。
export type StitchWorkerSuccess = {
  // true 表示图片处理成功。
  ok: true;

  // 成功时返回完整的图片拼接结果。
  result: StitchResult;
};

// 描述 worker 失败时返回的数据。
export type StitchWorkerFailure = {
  // false 表示这是一个可预期的业务错误。
  ok: false;

  // 用普通对象保存错误信息，便于跨 worker 传递。
  error: {
    // 业务错误码，例如 OUTPUT_TOO_LARGE。
    code: StitchErrorCode;

    // 给用户看的中文错误提示。
    message: string;
  };
};

// worker 的完整返回类型。
export type StitchWorkerOutput =
  | StitchWorkerSuccess
  | StitchWorkerFailure;

// 从 StitchError 中提取可以跨线程传递的错误信息。
function getStitchErrorDetails(error: StitchError): {
  code: StitchErrorCode;
  message: string;
} {
  // NestJS 的 HttpException 会保存接口响应内容。
  const response = error.getResponse();

  // 当前项目的 StitchError 响应固定是对象。
  if (
    typeof response !== 'object' ||
    response === null ||
    !('code' in response) ||
    !('message' in response) ||
    typeof response.code !== 'string' ||
    typeof response.message !== 'string'
  ) {
    // 如果错误结构不符合预期，就不要伪造业务错误。
    throw new Error('StitchError 的响应结构无效');
  }

  // StitchError 的构造函数保证 code 属于 StitchErrorCode。
  return {
    code: response.code as StitchErrorCode,
    message: response.message,
  };
}

// 这是 Piscina 实际执行的 worker 函数。
export default async function runStitch(
  input: StitchWorkerInput,
): Promise<StitchWorkerOutput> {
  try {
    // 在 worker 内执行现有的图片拼接流程。
    const result = await stitchImages(
      input.paths,
      input.workspaceDirectory,
    );

    // 成功时返回带有 ok 标记的普通对象。
    return {
      ok: true,
      result,
    };
  } catch (error) {
    // 只有预期的业务错误才转换成可传输的错误对象。
    if (error instanceof StitchError) {
      return {
        ok: false,
        error: getStitchErrorDetails(error),
      };
    }

    // 未知错误继续抛出，让主线程按 PROCESSING_FAILED 处理。
    throw error;
  }
}