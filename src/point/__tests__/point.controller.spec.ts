import { Test, TestingModule } from '@nestjs/testing';
import { PointController } from '../point.controller';
import { UserPointTable } from '../../database/userpoint.table';
import { PointHistoryTable } from '../../database/pointhistory.table';
import { PointBody } from '../point.dto';
import { PointService } from '../point.service';
import { PointException } from '../point.error';

/**
 * 포인트 관련 API 명세
 * - PATCH  `/point/{id}/charge` : 포인트를 충전한다.
 * - PATCH `/point/{id}/use` : 포인트를 사용한다.
 * - GET `/point/{id}` : 포인트를 조회한다.
 * - GET `/point/{id}/histories` : 포인트 내역을 조회한다.
 * - 잔고가 부족할 경우, 포인트 사용은 실패하여야 합니다.
 */
describe('PointController > ', () => {
  let controller: PointController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PointController],
      providers: [PointService, UserPointTable, PointHistoryTable],
    }).compile();

    controller = module.get<PointController>(PointController);
  });

  describe('포인트 충전', () => {
    test.each([
      ['음수 금액', -1000],
      ['0원', 0],
      ['소수점 금액', -0.5],
      ['문자열 금액', 'abc'],
      ['null 금액', null],
      ['undefined 금액', undefined],
    ])('%s으로 충전을 시도하면 실패한다', async (_, amount) => {
      const userId = 1;
      const point = new PointBody();
      point.amount = amount as never;

      await expect(controller.charge(userId, point)).rejects.toThrow(
        new PointException('충전 금액은 양의 정수여야 합니다.'),
      );
    });
  });

  describe('포인트 사용', () => {});

  describe('포인트 조회', () => {});

  describe('포인트 내역 조회', () => {});

  describe('잔고가 관리', () => {});
});
