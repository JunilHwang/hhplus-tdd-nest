import { Injectable } from '@nestjs/common';
import { PointService } from './point.service';
import { PointHistoryService } from './point-history.service';

@Injectable()
export class PointFacade {
  constructor(
    private readonly pointService: PointService,
    private readonly pointHistoryService: PointHistoryService,
  ) {}

  async getPoint(userId: number) {
    return await this.pointService.getPoint(userId);
  }

  async getPointHistory(userId: number) {
    return await this.pointHistoryService.getPointHistory(userId);
  }

  async chargePoint(userId: number, amount: number) {
    const point = await this.pointService.chargePoint(userId, amount);
    await this.pointHistoryService.chargePoint(userId, amount);

    return point;
  }

  async usePoint(userId: number, amount: number) {
    const point = await this.pointService.usePoint(userId, amount);
    await this.pointHistoryService.usePoint(userId, amount);

    return point;
  }
}
