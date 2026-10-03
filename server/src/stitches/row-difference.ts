/**
 * 重叠识别
 */

// 比较两张灰度图中指定的两行，返回平均像素差值。
// 返回 0 表示完全相同；数值越大，代表两行越不相似。
/**
 * 
 * @param firstPixels 第一张图片的像素数组
 * @param secondPixels 第二张图片的像素数组
 * @param width 图片的宽度
 * @param firstRow 第一行的索引
 * @param secondRow 第二行的索引
 * @returns 平均像素差值
 */
export function calculateRowDifference(
  firstPixels: Uint8Array,
  secondPixels: Uint8Array,
  width: number,
  firstRow: number,
  secondRow: number,
): number {
  // 单通道灰度图每行恰好有 width 个字节。
  if (
    !Number.isSafeInteger(width) ||
    width <= 0 ||
    firstPixels.length % width !== 0 ||
    secondPixels.length % width !== 0
  ) {
    throw new Error('灰度图宽度或像素数据无效');
  }

  // 防止读取到图片范围以外的行。
  if (
    !Number.isSafeInteger(firstRow) ||
    !Number.isSafeInteger(secondRow) ||
    firstRow < 0 ||
    secondRow < 0 ||
    firstRow >= firstPixels.length / width ||
    secondRow >= secondPixels.length / width
  ) {
    throw new Error('要比较的行超出了图片范围');
  }

  let totalDifference = 0; // 累加每行像素的差值。

  // 遍历行中的每个像素。
  for (let column = 0; column < width; column += 1) {
    // 行号乘以宽度得到这一行的起点，再加列号找到具体像素。
    const firstIndex = firstRow * width + column;
    const secondIndex = secondRow * width + column;

    // 累加两个灰度值之间的绝对差。
    totalDifference += Math.abs(
      firstPixels[firstIndex] - secondPixels[secondIndex],
    );
  }
  // 除以像素数量，得到不受图片宽度直接影响的平均差值。
  return totalDifference / width;
}
