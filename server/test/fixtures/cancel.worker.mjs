// 测试 worker：模拟一个可以运行很久的任务，方便测试取消。
export default async function cancelWorker(input) {
  // quick 模式用于确认取消后线程池还能继续工作。
  if (input.mode === 'quick') {
    return '完成';
  }

  // wait 模式故意等待较长时间，模拟正在运行的图片任务。
  await new Promise((resolve) => {
    setTimeout(resolve, input.delayMs);
  });

  return '不应该正常完成';
}