import { Test, TestingModule } from '@nestjs/testing';
import { PointController } from '../point.controller';
import { UserPointTable } from '../../database/userpoint.table';
import { PointHistoryTable } from '../../database/pointhistory.table';
import { PointBody } from '../point.dto';

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
  let userPointTable: UserPointTable;
  let pointHistoryTable: PointHistoryTable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PointController],
      providers: [UserPointTable, PointHistoryTable],
    }).compile();

    controller = module.get<PointController>(PointController);
    userPointTable = module.get<UserPointTable>(UserPointTable);
    pointHistoryTable = module.get<PointHistoryTable>(PointHistoryTable);
  });

  describe('포인트 충전', () => {
    test('음수 금액으로 충전을 시도하면 실패한다', async () => {
      const userId = 1;
      const negativeAmount = -1000;
      const pointDto: PointBody = { amount: negativeAmount };

      await expect(controller.charge(userId, pointDto)).rejects.toThrow();
    });

    test('0원 충전을 시도하면 실패한다', async () => {
      const userId = 1;
      const zeroAmount = 0;
      const pointDto: PointBody = { amount: zeroAmount };

      await expect(controller.charge(userId, pointDto)).rejects.toThrow();
    });
  });

  describe('포인트 사용', () => {});

  describe('포인트 조회', () => {});

  describe('포인트 내역 조회', () => {});

  describe('잔고가 관리', () => {});
});
