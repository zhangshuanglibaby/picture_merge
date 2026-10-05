/**
 * Piscina 最小通信 worker。
 * 这里只验证主线程和 worker 能传递数据，不依赖图片处理逻辑。
 */
export default function add(input) {
  return input.left + input.right;
}
