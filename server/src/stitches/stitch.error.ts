/**
 * 专用的错误码
 * 
 * 例如将来使用 new StitchError('INVALID_COUNT', '请选择 2～5 张图片')，预期响应是 HTTP 400，内容为 {"code":"INVALID_COUNT","message":"请选择 2～5 张图片"}
 */

import { HttpException, HttpStatus } from '@nestjs/common';

// 每种业务错误对应一个固定的 HTTP 状态码。
// 前端主要读取 code；HTTP 状态码用于区分请求错误和服务端错误。

const STATUS_BY_CODE = {
  INVALID_COUNT: HttpStatus.BAD_REQUEST,           // 图片数量不符合 2～5 张。
  INVALID_IMAGE: HttpStatus.BAD_REQUEST,           // 文件不是可读取的支持图片。
  IMAGE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,   // 上传文件或请求过大。
  OUTPUT_TOO_LARGE: HttpStatus.UNPROCESSABLE_ENTITY, // 拼接结果超出处理范围。
  BUSY: HttpStatus.SERVICE_UNAVAILABLE,            // 当前处理任务已满。
  PROCESSING_FAILED: HttpStatus.INTERNAL_SERVER_ERROR, // 实际处理失败。
  PROCESSING_TIMEOUT: HttpStatus.GATEWAY_TIMEOUT, // worker 执行超过时间限制。
} as const;

// 从上面的清单生成类型，避免在其他文件里拼错错误码。
export type StitchErrorCode = keyof typeof STATUS_BY_CODE;

export class StitchError extends HttpException {
  constructor(code: StitchErrorCode, message: string) {
    // NestJS 会把第一个参数作为 JSON 响应体，第二个参数作为 HTTP 状态码。
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}