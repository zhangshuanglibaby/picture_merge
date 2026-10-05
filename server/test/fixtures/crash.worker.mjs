/**
 *  验证 worker 线程意外退出后，Piscina 能否恢复处理后续任务 
 */

export default async function crashWorker(input) {
  // 模拟 worker 进程意外退出。
  if (input.mode === 'crash') {
    process.exit(1);
  }

  // worker 被 Piscina 恢复后，应该可以正常处理后续任务。
  return '完成';
}