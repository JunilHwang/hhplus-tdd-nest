import { IsInt } from 'class-validator';
import { InvalidPointRequestException } from './point.error';

export class PointBody {
  @IsInt()
  amount: number;

  static from(amount: number) {
    this.validate(amount);
    const body = new PointBody();
    body.amount = amount;
    return body;
  }

  static validate(
    amount: number,
    errorMessage = '포인트는 양의 정수여야 합니다.',
  ) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new InvalidPointRequestException(errorMessage);
    }
  }
}
