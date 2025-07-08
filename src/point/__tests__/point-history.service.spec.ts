import { Test, TestingModule } from '@nestjs/testing';
import { PointHistoryService } from '../point-history.service';
import { PointHistoryTable } from '../../database/pointhistory.table';
import { TransactionType } from '../point.model';
import { InvalidPointRequestException } from '../point.error';

const USER_ID = 1;
const OTHER_USER_ID = 2;

describe('PointHistoryService > ', () => {
  let service: PointHistoryService;
  let pointHistoryTable: PointHistoryTable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PointHistoryService, PointHistoryTable],
    }).compile();

    service = module.get<PointHistoryService>(PointHistoryService);
    pointHistoryTable = module.get<PointHistoryTable>(PointHistoryTable);
  });

  describe('getPointHistory > ', () => {
    beforeEach(async () => {
      await pointHistoryTable.insert(
        USER_ID,
        1000,
        TransactionType.CHARGE,
        Date.now(),
      );
      await pointHistoryTable.insert(
        USER_ID,
        -500,
        TransactionType.USE,
        Date.now(),
      );
    });

    test('사용자 포인트 내역을 조회한다', async () => {
      const result = await service.getPointHistory(USER_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: expect.any(Number),
        userId: USER_ID,
        amount: 1000,
        type: TransactionType.CHARGE,
        timeMillis: expect.any(Number),
      });
      expect(result[1]).toEqual({
        id: expect.any(Number),
        userId: USER_ID,
        amount: -500,
        type: TransactionType.USE,
        timeMillis: expect.any(Number),
      });
    });

    test('내역이 없는 사용자는 빈 배열을 반환한다', async () => {
      const result = await service.getPointHistory(OTHER_USER_ID);

      expect(result).toEqual([]);
    });

    test('여러 사용자의 내역이 혼재되어도 해당 사용자만 조회된다', async () => {
      await pointHistoryTable.insert(
        OTHER_USER_ID,
        2000,
        TransactionType.CHARGE,
        Date.now(),
      );

      const user1History = await service.getPointHistory(USER_ID);
      const user2History = await service.getPointHistory(OTHER_USER_ID);

      expect(user1History).toHaveLength(2);
      expect(user2History).toHaveLength(1);
      expect(user2History[0].userId).toBe(OTHER_USER_ID);
    });
  });

  describe('chargePoint > ', () => {
    test('포인트 충전 내역을 기록한다', async () => {
      const result = await service.chargePoint(USER_ID, 1000);

      expect(result).toEqual({
        id: expect.any(Number),
        userId: USER_ID,
        amount: 1000,
        type: TransactionType.CHARGE,
        timeMillis: expect.any(Number),
      });

      const histories = await service.getPointHistory(USER_ID);
      expect(histories).toHaveLength(1);
      expect(histories[0]).toEqual(result);
    });

    test('여러 번 충전 내역을 기록할 수 있다', async () => {
      await service.chargePoint(USER_ID, 1000);
      await service.chargePoint(USER_ID, 500);
      await service.chargePoint(USER_ID, 2000);

      const histories = await service.getPointHistory(USER_ID);
      expect(histories).toHaveLength(3);
      expect(histories[0].amount).toBe(1000);
      expect(histories[1].amount).toBe(500);
      expect(histories[2].amount).toBe(2000);
      expect(histories.every((h) => h.type === TransactionType.CHARGE)).toBe(
        true,
      );
    });

    test('최소 양의 정수 금액(1)으로 충전 내역을 기록할 수 있다', async () => {
      const result = await service.chargePoint(USER_ID, 1);

      expect(result).toEqual({
        id: expect.any(Number),
        userId: USER_ID,
        amount: 1,
        type: TransactionType.CHARGE,
        timeMillis: expect.any(Number),
      });
    });

    test('최대 정수 값으로 충전 내역을 기록할 수 있다', async () => {
      const result = await service.chargePoint(
        USER_ID,
        Number.MAX_SAFE_INTEGER,
      );

      expect(result).toEqual({
        id: expect.any(Number),
        userId: USER_ID,
        amount: Number.MAX_SAFE_INTEGER,
        type: TransactionType.CHARGE,
        timeMillis: expect.any(Number),
      });
    });

    test.each([
      { amount: 0, description: '0' },
      { amount: -1, description: '음수' },
      { amount: -100, description: '음수' },
      { amount: 1.5, description: '소수' },
      { amount: -0.5, description: '음수 소수' },
      { amount: NaN, description: 'NaN' },
      { amount: Infinity, description: 'Infinity' },
      { amount: -Infinity, description: '-Infinity' },
    ])(
      '$description 금액으로 충전 내역 기록을 시도하면 실패한다',
      async ({ amount }) => {
        await expect(service.chargePoint(USER_ID, amount)).rejects.toThrow(
          new InvalidPointRequestException('충전 금액은 양의 정수여야 합니다.'),
        );
      },
    );

    test('시간 정보가 정확히 기록된다', async () => {
      const beforeTime = Date.now();
      const result = await service.chargePoint(USER_ID, 1000);
      const afterTime = Date.now();

      expect(result.timeMillis).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timeMillis).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('usePoint > ', () => {
    test('포인트 사용 내역을 기록한다', async () => {
      const result = await service.usePoint(USER_ID, 500);

      expect(result).toEqual({
        id: expect.any(Number),
        userId: USER_ID,
        amount: -500,
        type: TransactionType.USE,
        timeMillis: expect.any(Number),
      });

      const histories = await service.getPointHistory(USER_ID);
      expect(histories).toHaveLength(1);
      expect(histories[0]).toEqual(result);
    });

    test('여러 번 사용 내역을 기록할 수 있다', async () => {
      await service.usePoint(USER_ID, 300);
      await service.usePoint(USER_ID, 200);
      await service.usePoint(USER_ID, 100);

      const histories = await service.getPointHistory(USER_ID);
      expect(histories).toHaveLength(3);
      expect(histories[0].amount).toBe(-300);
      expect(histories[1].amount).toBe(-200);
      expect(histories[2].amount).toBe(-100);
      expect(histories.every((h) => h.type === TransactionType.USE)).toBe(true);
    });

    test('최소 양의 정수 금액(1)으로 사용 내역을 기록할 수 있다', async () => {
      const result = await service.usePoint(USER_ID, 1);

      expect(result).toEqual({
        id: expect.any(Number),
        userId: USER_ID,
        amount: -1,
        type: TransactionType.USE,
        timeMillis: expect.any(Number),
      });
    });

    test('최대 정수 값으로 사용 내역을 기록할 수 있다', async () => {
      const result = await service.usePoint(USER_ID, Number.MAX_SAFE_INTEGER);

      expect(result).toEqual({
        id: expect.any(Number),
        userId: USER_ID,
        amount: -Number.MAX_SAFE_INTEGER,
        type: TransactionType.USE,
        timeMillis: expect.any(Number),
      });
    });

    test.each([
      { amount: 0, description: '0' },
      { amount: -1, description: '음수' },
      { amount: -100, description: '음수' },
      { amount: 1.5, description: '소수' },
      { amount: -0.5, description: '음수 소수' },
      { amount: NaN, description: 'NaN' },
      { amount: Infinity, description: 'Infinity' },
      { amount: -Infinity, description: '-Infinity' },
    ])(
      '$description 금액으로 사용 내역 기록을 시도하면 실패한다',
      async ({ amount }) => {
        await expect(service.usePoint(USER_ID, amount)).rejects.toThrow(
          new InvalidPointRequestException('사용 금액은 양의 정수여야 합니다.'),
        );
      },
    );

    test('시간 정보가 정확히 기록된다', async () => {
      const beforeTime = Date.now();
      const result = await service.usePoint(USER_ID, 500);
      const afterTime = Date.now();

      expect(result.timeMillis).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timeMillis).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('충전과 사용 내역의 혼합', () => {
    test('충전과 사용 내역이 모두 기록된다', async () => {
      await service.chargePoint(USER_ID, 1000);
      await service.usePoint(USER_ID, 300);
      await service.chargePoint(USER_ID, 500);
      await service.usePoint(USER_ID, 200);

      const histories = await service.getPointHistory(USER_ID);
      expect(histories).toEqual([
        {
          id: expect.any(Number),
          userId: USER_ID,
          amount: 1000,
          type: TransactionType.CHARGE,
          timeMillis: expect.any(Number),
        },
        {
          id: expect.any(Number),
          userId: USER_ID,
          amount: -300,
          type: TransactionType.USE,
          timeMillis: expect.any(Number),
        },
        {
          id: expect.any(Number),
          userId: USER_ID,
          amount: 500,
          type: TransactionType.CHARGE,
          timeMillis: expect.any(Number),
        },
        {
          id: expect.any(Number),
          userId: USER_ID,
          amount: -200,
          type: TransactionType.USE,
          timeMillis: expect.any(Number),
        },
      ]);
    });
  });

  describe('서로 다른 사용자 간의 독립성', () => {
    test('서로 다른 사용자의 내역이 독립적으로 기록된다', async () => {
      await service.chargePoint(USER_ID, 1000);
      await service.usePoint(USER_ID, 300);

      await service.chargePoint(OTHER_USER_ID, 2000);
      await service.usePoint(OTHER_USER_ID, 500);

      const user1History = await service.getPointHistory(USER_ID);
      const user2History = await service.getPointHistory(OTHER_USER_ID);

      expect(user1History).toHaveLength(2);
      expect(user2History).toHaveLength(2);

      expect(user1History.every((h) => h.userId === USER_ID)).toBe(true);
      expect(user2History.every((h) => h.userId === OTHER_USER_ID)).toBe(true);
    });

    test('한 사용자의 내역이 다른 사용자에게 영향을 주지 않는다', async () => {
      await service.chargePoint(USER_ID, 1000);
      await service.chargePoint(OTHER_USER_ID, 2000);

      await service.usePoint(USER_ID, 300);

      const user1History = await service.getPointHistory(USER_ID);
      const user2History = await service.getPointHistory(OTHER_USER_ID);

      expect(user1History).toHaveLength(2);
      expect(user2History).toHaveLength(1);
      expect(user2History[0].type).toBe(TransactionType.CHARGE);
    });
  });

  describe('ID 생성 및 고유성', () => {
    test('각 내역은 고유한 ID를 가진다', async () => {
      await service.chargePoint(USER_ID, 1000);
      await service.usePoint(USER_ID, 300);
      await service.chargePoint(USER_ID, 500);

      const histories = await service.getPointHistory(USER_ID);
      const ids = histories.map((h) => h.id);

      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3); // 모든 ID가 고유함
    });

    test('서로 다른 사용자의 내역도 고유한 ID를 가진다', async () => {
      await service.chargePoint(USER_ID, 1000);
      await service.chargePoint(OTHER_USER_ID, 2000);

      const user1History = await service.getPointHistory(USER_ID);
      const user2History = await service.getPointHistory(OTHER_USER_ID);

      expect(user1History[0].id).not.toBe(user2History[0].id);
    });
  });
});
