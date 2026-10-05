/**
 * 管理图片拼接任务的并发位置和等待队列。
 *
 * 当前配置：
 * - 同时执行：最多 2 个任务
 * - 等待队列：最多 2 个任务
 */

// 同时执行的任务数量上限。
const MAX_ACTIVE_TASKS = 2;

// 正在等待执行的位置数量上限。
const MAX_WAITING_TASKS = 2;

// 任务完成后调用的释放函数类型。
type ReleaseTask = () => void;

// 等待任务的处理函数类型。
type WaitingResolver = (release: ReleaseTask) => void;

export class StitchTaskLimiter {
  // 当前正在执行的任务数量。
  private activeTasks = 0;

  // 等待执行的任务。
  private waitingResolvers: WaitingResolver[] = [];

  /**
   * 立即尝试取得执行位置。
   *
   * 这个方法不会进入等待队列：
   * - 有空位：返回释放函数
   * - 没有空位：返回 null
   */
  tryAcquire(): ReleaseTask | null {
    // 已经达到同时执行数量上限。
    if (this.activeTasks >= MAX_ACTIVE_TASKS) {
      return null;
    }

    // 占用一个执行位置。
    this.activeTasks += 1;

    // 返回这个任务对应的释放函数。
    return this.createReleaseTask();
  }

  /**
   * 取得执行位置；没有空位时进入有限等待队列。
   *
   * 返回 null 表示：
   * - 执行位置已满
   * - 等待队列也已满
   */
  async acquire(): Promise<ReleaseTask | null> {
    // 先尝试立即取得执行位置。
    const release = this.tryAcquire();

    // 有空位时直接返回释放函数。
    if (release !== null) {
      return release;
    }

    // 等待队列已满时，不再接受新任务。
    if (this.waitingResolvers.length >= MAX_WAITING_TASKS) {
      return null;
    }

    // 没有立即空位，但队列还有容量。
    // 返回一个尚未完成的 Promise，等已有任务释放位置。
    return new Promise<ReleaseTask>((resolve) => {
      this.waitingResolvers.push(resolve);
    });
  }

  /**
   * 创建一个只能执行一次的释放函数。
   */
  private createReleaseTask(): ReleaseTask {
    // 防止同一个任务重复释放位置。
    let released = false;

    return () => {
      // 已经释放过的位置不能重复处理。
      if (released) {
        return;
      }

      released = true;

      // 如果有等待任务，直接把刚释放的位置交给它。
      const nextWaitingTask = this.waitingResolvers.shift();

      if (nextWaitingTask) {
        // activeTasks 不减少，因为位置马上被下一个任务接管。
        nextWaitingTask(this.createReleaseTask());
        return;
      }

      // 没有等待任务时，真正减少执行中的任务数量。
      this.activeTasks -= 1;
    };
  }

  // 返回当前正在执行的任务数量。
  getActiveCount(): number {
    return this.activeTasks;
  }

  // 返回当前等待队列中的任务数量。
  getWaitingCount(): number {
    return this.waitingResolvers.length;
  }
}