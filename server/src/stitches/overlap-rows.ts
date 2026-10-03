/**
 * 让程序根据两张图的高度，自动生成要尝试的重叠行数。它只负责“出题”
 * rankOverlapCandidates() 负责“打分”
 */

// 创建候选行数生成函数

// 粗筛时最多尝试多少种重叠高度；这是暂定值，后续要用真实图片测试。
const MAX_COARSE_CANDIDATES = 256;

/**
 * 
 * @param firstHeight 第一张图片的高度
 * @param secondHeight 第二张图片的高度
 * @returns 要尝试的重叠行数列表
 */
export function createOverlapRowsToTry(
  firstHeight: number,
  secondHeight: number,
): number[] {
  // 图片高度必须是正整数，否则无法按“行”进行比较。
  if (
    !Number.isSafeInteger(firstHeight) ||
    !Number.isSafeInteger(secondHeight) ||
    firstHeight < 1 ||
    secondHeight < 1
  ) {
    throw new Error('图片高度必须是正整数');
  }

  // 重叠高度最多等于两张图片中较短的那张。
  const maxOverlapRows = Math.min(firstHeight, secondHeight);
  const count = Math.min(maxOverlapRows, MAX_COARSE_CANDIDATES);

  // 两张图片都只有 1 行时，唯一能尝试的高度就是 1。
  if (count === 1) {
    return [1];
  }

  // 生成候选行数列表。
  const rows: number[] = [];

  // 均匀分布候选高度，从 1 开始，到 maxOverlapRows 结束。
  for (let index = 0; index < count; index += 1) {
    // 把 count 个候选均匀分布在 1 到 maxOverlapRows 之间。
    // 例如最大高度是 4、count 是 4，就得到 1、2、3、4。
    const overlapRows = Math.round(
      1 + (index * (maxOverlapRows - 1)) / (count - 1),
    );
    rows.push(overlapRows);
  }

  return rows;
}