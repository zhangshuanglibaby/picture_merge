// 这是 Piscina 工作线程的入口函数。
// 主线程以后会把图片处理任务传给这里。
export default function addNumbers(input: {
  // 第一个参与计算的数字。
  left: number;

  // 第二个参与计算的数字。
  right: number;
}): number {
  // 当前只做最简单的加法，用来验证 worker 通道。
  // 下一步才会替换成图片处理逻辑。
  return input.left + input.right;
}