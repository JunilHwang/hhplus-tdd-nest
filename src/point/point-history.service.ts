import { Injectable } from '@nestjs/common';
import { PointHistoryTable } from '../database/pointhistory.table';
import { TransactionType } from './point.model';
import { PointBody } from './point.dto';

@Injectable()
export class PointHistoryService {
  constructor(private readonly pointHistoryTable: PointHistoryTable) {}

  async getPointHistory(userId: number) {
    return await this.pointHistoryTable.selectAllByUserId(userId);
  }

  async chargePoint(userId: number, amount: number) {
    PointBody.validate(amount, '충전 금액은 양의 정수여야 합니다.');

    return await this.pointHistoryTable.insert(
      userId,
      amount,
      TransactionType.CHARGE,
      Date.now(),
    );
  }

  async usePoint(userId: number, amount: number) {
    PointBody.validate(amount, '사용 금액은 양의 정수여야 합니다.');

    return await this.pointHistoryTable.insert(
      userId,
      -amount,
      TransactionType.USE,
      Date.now(),
    );
  }
}
