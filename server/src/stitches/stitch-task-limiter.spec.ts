// describe 用来把相关测试归为一组；it 定义一个测试场景；
// expect 用来检查实际结果是否符合预期。这三个工具都来自 Vitest。
import { describe, expect, it } from 'vitest';

// 引入上一步编写的任务位置计数器，测试它的取得与归还行为。
import { StitchTaskLimiter } from './stitch-task-limiter.js';

describe('StitchTaskLimiter', () => {
  it('同时只允许两个任务取得位置', () => {
    // 每个测试创建新的计数器，避免其他测试占用它的位置。
    const limiter = new StitchTaskLimiter();

    // 前两个任务分别取得一个位置。
    const releaseFirst = limiter.tryAcquire();
    const releaseSecond = limiter.tryAcquire();

    expect(releaseFirst).toBeTypeOf('function');
    expect(releaseSecond).toBeTypeOf('function');
    expect(limiter.getActiveCount()).toBe(2);

    // 两个位置已满，第三个任务暂时进不来。
    expect(limiter.tryAcquire()).toBeNull();
    expect(limiter.getActiveCount()).toBe(2);
  });

  it('任务归还位置后，其他任务可以进入', () => {
    const limiter = new StitchTaskLimiter();

    // 先占满两个位置。
    const releaseFirst = limiter.tryAcquire();
    limiter.tryAcquire();

    // 确认第一个任务确实取得了位置，再归还它。
    expect(releaseFirst).toBeTypeOf('function');
    releaseFirst?.();

    expect(limiter.getActiveCount()).toBe(1);

    // 空出来一个位置后，新任务可以取得它。
    const releaseThird = limiter.tryAcquire();
    expect(releaseThird).toBeTypeOf('function');
    expect(limiter.getActiveCount()).toBe(2);
  });

  it('同一个位置重复归还不会把计数减成负数', () => {
    const limiter = new StitchTaskLimiter();
    const release = limiter.tryAcquire();

    // 模拟同一个任务的收尾逻辑被调用了两次。
    release?.();
    release?.();

    // 一个任务只应让计数减少一次。
    expect(limiter.getActiveCount()).toBe(0);
  });
});