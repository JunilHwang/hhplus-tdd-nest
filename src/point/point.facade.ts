import { BadRequestException, Injectable } from '@nestjs/common';
import { PointService } from './point.service';
import { PointHistoryService } from './point-history.service';

@Injectable()
export class PointFacade {
  private readonly userQueues = new Map<number, Promise<any>>();

  constructor(
    private readonly pointService: PointService,
    private readonly pointHistoryService: PointHistoryService,
  ) {}

  #validateUserId(userId: number) {
    if (
      typeof userId !== 'number' ||
      userId <= 0 ||
      !Number.isInteger(userId) ||
      isNaN(userId)
    ) {
      throw new BadRequestException('올바르지 않은 ID 값 입니다.');
    }
  }

  async getPoint(userId: number) {
    this.#validateUserId(userId);
    return await this.pointService.getPoint(userId);
  }

  async getPointHistory(userId: number) {
    this.#validateUserId(userId);
    return await this.pointHistoryService.getPointHistory(userId);
  }

  private async processWithQueue<T>(
    userId: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    const currentQueue = this.userQueues.get(userId) ?? Promise.resolve();
    const newQueue = currentQueue.then(async () => {
      try {
        return await operation();
      } catch (error) {
        throw error;
      }
    });

    this.userQueues.set(userId, newQueue);

    return newQueue;
  }

  async chargePoint(userId: number, amount: number) {
    this.#validateUserId(userId);
    return this.processWithQueue(userId, async () => {
      const point = await this.pointService.chargePoint(userId, amount);
      await this.pointHistoryService.chargePoint(userId, amount);
      return point;
    });
  }

  async usePoint(userId: number, amount: number) {
    this.#validateUserId(userId);
    return this.processWithQueue(userId, async () => {
      const point = await this.pointService.usePoint(userId, amount);
      await this.pointHistoryService.usePoint(userId, amount);
      return point;
    });
  }
}
