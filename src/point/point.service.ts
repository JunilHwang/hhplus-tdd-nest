import { Injectable } from '@nestjs/common';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { PointException } from './point.error';

@Injectable()
export class PointService {
  constructor(
    // Inject the necessary database tables or repositories here
    private readonly userPointTable: UserPointTable,
    private readonly pointHistoryTable: PointHistoryTable,
  ) {}

  async chargePoint(userId: number, amount: number) {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new PointException('충전 금액은 양의 정수여야 합니다.');
    }

    console.log(userId, amount);

    return await this.userPointTable.insertOrUpdate(userId, amount);
  }
}
