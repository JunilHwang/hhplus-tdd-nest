import { BadRequestException } from '@nestjs/common';

export class PointException extends Error {
  name = 'PointException';
}

// 유효하지 않은 포인트 요청에 대한 오류
export class InvalidPointRequestException extends BadRequestException {
  name = 'InvalidPointRequestException';
  constructor(message = '유효하지 않은 포인트 요청입니다.') {
    super(message);
  }
}

// 포인트 잔고가 부족할 때 발생하는 오류
export class InsufficientPointException extends BadRequestException {
  name = 'InsufficientPointException';
  constructor(message = '포인트 잔고가 부족합니다.') {
    super(message);
  }
}
