import { Injectable } from '@nestjs/common';
import { UserPointTable } from '../database/userpoint.table';
import {
  InsufficientPointException,
  InvalidPointRequestException,
} from './point.error';

@Injectable()
export class PointService {
  constructor(private readonly userPointTable: UserPointTable) {}

  #validateAmount(amount: number, error?: string) {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new InvalidPointRequestException(error);
    }
  }

  async chargePoint(userId: number, amount: number) {
    this.#validateAmount(amount, '충전 금액은 양의 정수여야 합니다.');

    return await this.userPointTable.insertOrUpdate(userId, amount);
  }

  async getPoint(userId: number) {
    return await this.userPointTable.selectById(userId);
  }

  async usePoint(userId: number, amount: number) {
    this.#validateAmount(amount, '사용 금액은 양의 정수여야 합니다.');

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
