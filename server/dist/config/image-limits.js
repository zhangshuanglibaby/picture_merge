export const IMAGE_LIMITS = {
    minImages: 2,
    maxImages: 5,
    maxFileBytes: 15 * 1024 * 1024,
    maxUploadBytes: 50 * 1024 * 1024,
    maxInputPixels: 12_000_000,
    maxInputSide: 16_000,
    maxOutputPixels: 25_000_000,
    maxOutputHeight: 30_000,
};
export function validateImageLimits() {
    const values = Object.values(IMAGE_LIMITS);
    const validNumbers = values.every((value) => Number.isSafeInteger(value) && value > 0);
    if (!validNumbers ||
        IMAGE_LIMITS.minImages !== 2 ||
        IMAGE_LIMITS.maxImages !== 5 ||
        IMAGE_LIMITS.maxUploadBytes < IMAGE_LIMITS.maxFileBytes) {
        throw new Error('图片处理限制配置不正确');
    }
}
//# sourceMappingURL=image-limits.js.map