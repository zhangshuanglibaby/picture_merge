// 服务端处理任务相关的时间限制。
export const PROCESSING_LIMITS = {
  // 单个图片拼接任务最多运行 30 秒。
  maxWorkerTimeMs: 30_000,
} as const;