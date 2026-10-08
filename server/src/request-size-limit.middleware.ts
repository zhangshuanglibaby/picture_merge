/**
 * 请求体大小中间件：限制一次 HTTP 请求的最大字节数。
 */
// 引入 Express 中间件需要的类型。
// Request 表示请求，Response 表示响应，NextFunction 表示继续执行后续流程。
import type { NextFunction, Request, Response } from 'express';

// 引入统一的图片上传大小限制。
// 这里使用同一个配置，避免中间件和业务校验使用不同数字。
import { IMAGE_LIMITS } from './config/image-limits.js';

// 统一返回给前端的错误内容。
const TOO_LARGE_RESPONSE = {
  code: 'IMAGE_TOO_LARGE',
  message: '本次上传总大小超出限制',
} as const;

/**
 * 限制一次 HTTP 请求的最大字节数。
 *
 * 这个中间件要放在 Multer 之前：
 * 1. 有 Content-Length 时，可以提前判断；
 * 2. 没有 Content-Length 时，边接收边累计字节数；
 * 3. 超过限制后立即返回 413，并停止请求。
 */
export function requestSizeLimitMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  // 读取请求头中的 Content-Length。
  // 它表示整个 HTTP 请求体的字节数，包含 multipart 的边界信息。
  const contentLengthHeader = request.headers['content-length'];

  // 将请求头字符串转换成数字。
  const contentLength =
    typeof contentLengthHeader === 'string'
      ? Number(contentLengthHeader)
      : Number.NaN;

  // 如果请求明确声明的大小已经超过限制，就不让它进入 Multer。
  if (
    Number.isSafeInteger(contentLength) &&
    contentLength > IMAGE_LIMITS.maxUploadBytes
  ) {
    response.status(413).json(TOO_LARGE_RESPONSE);
    return;
  }

  // 请求头给出合法的总长度且未超限时，无须读取请求流。
  if (Number.isSafeInteger(contentLength) && contentLength >= 0) {
    // 保持请求暂停状态，让 Multer 收到完整的 multipart 数据。
    next();
    return;
  }

  // 当前已经收到的请求体字节数。
  let receivedBytes = 0;

  // 防止请求超过限制后重复处理。
  let rejected = false;

  // 请求体收到一段数据时执行。
  const handleData = (chunk: Buffer | string): void => {
    // 超限后不再重复计算或重复发送响应。
    if (rejected) {
      return;
    }

    // Buffer 直接读取 length；字符串按照 UTF-8 计算实际字节数。
    receivedBytes +=
      typeof chunk === 'string'
        ? Buffer.byteLength(chunk)
        : chunk.length;

    // 分块传输没有 Content-Length，只能在这里判断是否超限。
    if (receivedBytes <= IMAGE_LIMITS.maxUploadBytes) {
      return;
    }

    // 标记为已拒绝，避免后续数据再次进入这段逻辑。
    rejected = true;

    // 先移除当前监听，避免继续累计请求体。
    request.removeListener('data', handleData);

    // 如果响应还没有开始，就返回统一的 413 JSON。
    if (!response.headersSent) {
      response.status(413).json(TOO_LARGE_RESPONSE);
    }

    // 主动关闭请求，停止继续接收超大的上传内容。
    request.destroy();
  };

  // 请求正常结束或连接关闭时，移除监听器。
  const cleanup = (): void => {
    // 移除等待流开始读取的监听器。
    request.removeListener('resume', startCounting);
    request.removeListener('data', handleData);
    request.removeListener('end', cleanup);
    request.removeListener('close', cleanup);
  };

  // 下游开始读取时才监听数据；提前监听 data 会让流先于 Multer 开始流动。
  const startCounting = (): void => {
    // 在 resume 事件触发时，下游已准备好读取请求体。
    request.on('data', handleData);
  };

  // 无长度请求开始流动时才安装计数器。
  request.once('resume', startCounting);

  // 正常接收完毕后清理监听器。
  request.on('end', cleanup);

  // 客户端提前断开时也清理监听器。
  request.on('close', cleanup);

  // 请求没有超限，继续交给 Multer、Controller 和其他中间件。
  next();
}
