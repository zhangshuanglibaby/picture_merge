/**
 * 同时最多处理两个拼接任务 的计数器
 * 
 * 想象只有两个工作位置：前两个任务可以进入；第三个暂时没有位置。任务结束后归还位置，后续任务才能进入。
 */

// 同时允许多少个任务进行图片拼接。
// 暂定为 2；这是初始保护值，后续要根据实际内存和压测结果调整。
const MAX_ACTIVE_TASKS = 2;


export class StitchTaskLimiter {
  // 当前已经占用的工作位置数量。每个计数器实例单独记录。
  private activeTasks = 0;

  /**
  * 尝试取得一个工作位置。
  * 成功时返回“归还位置”的函数；位置用完时返回 null。
  */
  tryAcquire(): (() => void) | null {
    // 两个位置都被占用时，不再接受新的处理任务。
    if (this.activeTasks >= MAX_ACTIVE_TASKS) {
      return null;
    }

    // 占用一个位置。例如原来是 0，现在变成 1。
    this.activeTasks += 1;

    // 防止调用方不小心归还两次，导致计数变成负数。
    let released = false;

    return () => {
      // 同一个位置已经归还过，就不能重复归还。
      if (released) {
        return;
      }

      released = true;
      this.activeTasks -= 1;
    };
  }

  // 只用于查看当前占用量；调用它不会增加或减少位置。
  getActiveCount(): number {
    return this.activeTasks;
  }
}