// 这些数值是开发阶段的起点，之后要用真实截图和部署环境验证。
export const IMAGE_LIMITS = {
  minImages: 2,                    // 一次至少上传 2 张。
  maxImages: 5,                    // 一次最多上传 5 张。
  maxFileBytes: 15 * 1024 * 1024, // 单张最多 15 MiB。
  maxUploadBytes: 50 * 1024 * 1024, // 一次上传暂定最多 50 MiB。
  maxInputPixels: 12_000_000,     // 单张最多 1200 万像素。
  maxInputSide: 16_000,           // 单张最长边最多 16000 像素。
  maxOutputPixels: 25_000_000,    // 拼接结果最多 2500 万像素。
  maxOutputHeight: 30_000,        // 拼接结果最高 30000 像素。
} as const;

// 启动时检查配置有没有被意外改成不合理的值。
export function validateImageLimits(): void {
  const values = Object.values(IMAGE_LIMITS);

  // 所有限制都应为大于零的安全整数。
  const validNumbers = values.every(
    (value) => Number.isSafeInteger(value) && value > 0,
  );

  // 2～5 张是 PRD 确定的产品规则；总量不能小于单张上限。
  if (
    !validNumbers ||
    IMAGE_LIMITS.minImages !== 2 ||
    IMAGE_LIMITS.maxImages !== 5 ||
    IMAGE_LIMITS.maxUploadBytes < IMAGE_LIMITS.maxFileBytes
  ) {
    throw new Error('图片处理限制配置不正确');
  }
}