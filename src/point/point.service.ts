import { Injectable } from '@nestjs/common';
import { UserPointTable } from '../database/userpoint.table';
import { InsufficientPointException } from './point.error';
import { PointBody } from './point.dto';

@Injectable()
export class PointService {
  constructor(private readonly userPointTable: UserPointTable) {}

  async getPoint(userId: number) {
    return await this.userPointTable.selectById(userId);
  }

  async chargePoint(userId: number, amount: number) {
    PointBody.validate(amount, '충전 금액은 양의 정수여야 합니다.');

    const userPoint = await this.userPointTable.selectById(userId);
    return await this.userPointTable.insertOrUpdate(
      userId,
      userPoint.point + amount,
    );
  }

  async usePoint(userId: number, amount: number) {
    PointBody.validate(amount, '사용 금액은 양의 정수여야 합니다.');

    const userPoint = await this.userPointTable.selectById(userId);
    if (userPoint.point < amount) {
      throw new InsufficientPointException('잔고가 부족합니다.');
    }

    return await this.userPointTable.insertOrUpdate(
      userId,
      userPoint.point - amount,
    );
  }
}
