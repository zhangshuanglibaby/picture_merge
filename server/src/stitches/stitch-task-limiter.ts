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
  * 取得执行位置；位置满时等待。
  * signal 被取消时，从等待队列移除本任务。
  */
  async acquire(signal?: AbortSignal): Promise<ReleaseTask | null> {
    // 已经取消的任务不能再占用位置。
    if (signal?.aborted) {
      throw new DOMException('等待任务已取消', 'AbortError');
    }

    // 有空位时沿用原来的立即取得逻辑。
    const release = this.tryAcquire();
    if (release !== null) {
      return release;
    }

    // 两个等待位置也满了，沿用原来的 BUSY 判断。
    if (this.waitingResolvers.length >= MAX_WAITING_TASKS) {
      return null;
    }

    // 创建一个等待释放位置的 Promise。
    return new Promise<ReleaseTask>((resolve, reject) => {
      // 有人释放位置时，移除取消监听，再把位置交给等待任务。
      const wake: WaitingResolver = (nextRelease) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(nextRelease);
      };

      // 取消时只移除仍在排队的任务，不改变正在执行的任务数量。
      const onAbort = () => {
        const index = this.waitingResolvers.indexOf(wake);
        if (index === -1) {
          return;
        }
        this.waitingResolvers.splice(index, 1);
        reject(new DOMException('等待任务已取消', 'AbortError'));
      };

      // 先登记等待任务，再监听取消。
      this.waitingResolvers.push(wake);
      signal?.addEventListener('abort', onAbort, { once: true });
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