import { Injectable } from '@nestjs/common';
import { UserPointTable } from '../database/userpoint.table';
import { PointException } from './point.error';

@Injectable()
export class PointService {
  constructor(private readonly userPointTable: UserPointTable) {}

  async chargePoint(userId: number, amount: number) {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new PointException('충전 금액은 양의 정수여야 합니다.');
    }

    return await this.userPointTable.insertOrUpdate(userId, amount);
  }

  async getPoint(userId: number) {
    return await this.userPointTable.selectById(userId);
  }
}
