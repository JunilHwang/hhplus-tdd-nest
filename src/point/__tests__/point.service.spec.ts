import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from '../point.service';
import { UserPointTable } from '../../database/userpoint.table';
import {
  InsufficientPointException,
  InvalidPointRequestException,
} from '../point.error';

const USER_ID = 1;
const OTHER_USER_ID = 2;

describe('PointService > ', () => {
  let service: PointService;
  let userPointTable: UserPointTable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PointService, UserPointTable],
    }).compile();

    service = module.get<PointService>(PointService);
    userPointTable = module.get<UserPointTable>(UserPointTable);
  });

  describe('getPoint > ', () => {
    beforeEach(async () => {
      await userPointTable.insertOrUpdate(USER_ID, 1000);
    });

    test('사용자 포인트를 조회한다', async () => {
      const result = await service.getPoint(USER_ID);

      expect(result).toEqual({
        id: USER_ID,
        point: 1000,
        updateMillis: expect.any(Number),
      });
    });

    test('존재하지 않는 사용자는 0 포인트로 조회된다', async () => {
      const result = await service.getPoint(OTHER_USER_ID);

      expect(result).toEqual({
        id: OTHER_USER_ID,
        point: 0,
        updateMillis: expect.any(Number),
      });
    });
  });

  describe('chargePoint > ', () => {
    test('포인트를 충전한다', async () => {
      const result = await service.chargePoint(USER_ID, 1000);

      expect(result).toEqual({
        id: USER_ID,
        point: 1000,
        updateMillis: expect.any(Number),
      });
    });

    test('기존 포인트에 충전 금액을 추가한다', async () => {
      await userPointTable.insertOrUpdate(USER_ID, 500);

      const result = await service.chargePoint(USER_ID, 1000);

      expect(result).toEqual({
        id: USER_ID,
        point: 1500,
        updateMillis: expect.any(Number),
      });
    });

    test('최대 정수 값까지 충전할 수 있다', async () => {
      const result = await service.chargePoint(
        USER_ID,
        Number.MAX_SAFE_INTEGER,
      );

      expect(result).toEqual({
        id: USER_ID,
        point: Number.MAX_SAFE_INTEGER,
        updateMillis: expect.any(Number),
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
    ])('$description 금액으로 충전을 시도하면 실패한다', async ({ amount }) => {
      await expect(service.chargePoint(USER_ID, amount)).rejects.toThrow(
        new InvalidPointRequestException('충전 금액은 양의 정수여야 합니다.'),
      );
    });

    test('최소 양의 정수 금액(1)으로 충전할 수 있다', async () => {
      const result = await service.chargePoint(USER_ID, 1);

      expect(result).toEqual({
        id: USER_ID,
        point: 1,
        updateMillis: expect.any(Number),
      });
    });
  });

  describe('usePoint > ', () => {
    beforeEach(async () => {
      await userPointTable.insertOrUpdate(USER_ID, 1000);
    });

    test('포인트를 사용한다', async () => {
      const result = await service.usePoint(USER_ID, 500);

      expect(result).toEqual({
        id: USER_ID,
        point: 500,
        updateMillis: expect.any(Number),
      });
    });

    test('모든 포인트를 사용할 수 있다', async () => {
      const result = await service.usePoint(USER_ID, 1000);

      expect(result).toEqual({
        id: USER_ID,
        point: 0,
        updateMillis: expect.any(Number),
      });
    });

    test('최소 양의 정수 금액(1)으로 사용할 수 있다', async () => {
      const result = await service.usePoint(USER_ID, 1);

      expect(result).toEqual({
        id: USER_ID,
        point: 999,
        updateMillis: expect.any(Number),
      });
    });

    test.each([
      {
        currentPoint: 1000,
        useAmount: 1001,
        description: '잔고보다 1 많은 금액',
      },
      { currentPoint: 500, useAmount: 600, description: '잔고보다 많은 금액' },
      { currentPoint: 0, useAmount: 1, description: '잔고가 0일 때 1 포인트' },
      { currentPoint: 100, useAmount: 200, description: '잔고의 2배 금액' },
    ])(
      '$description 사용을 시도하면 실패한다',
      async ({ currentPoint, useAmount }) => {
        await userPointTable.insertOrUpdate(USER_ID, currentPoint);

        await expect(service.usePoint(USER_ID, useAmount)).rejects.toThrow(
          new InsufficientPointException('잔고가 부족합니다.'),
        );
      },
    );

    test.each([
      { amount: 0, description: '0' },
      { amount: -1, description: '음수' },
      { amount: -100, description: '음수' },
      { amount: 1.5, description: '소수' },
      { amount: -0.5, description: '음수 소수' },
      { amount: NaN, description: 'NaN' },
      { amount: Infinity, description: 'Infinity' },
      { amount: -Infinity, description: '-Infinity' },
    ])('$description 금액으로 사용을 시도하면 실패한다', async ({ amount }) => {
      await expect(service.usePoint(USER_ID, amount)).rejects.toThrow(
        new InvalidPointRequestException('사용 금액은 양의 정수여야 합니다.'),
      );
    });

    test('연속으로 포인트를 사용할 수 있다', async () => {
      const result1 = await service.usePoint(USER_ID, 300);
      expect(result1.point).toBe(700);

      const result2 = await service.usePoint(USER_ID, 200);
      expect(result2.point).toBe(500);

      const result3 = await service.usePoint(USER_ID, 500);
      expect(result3.point).toBe(0);
    });

    test('포인트 사용 후 잔고가 부족하면 다음 사용이 실패한다', async () => {
      await service.usePoint(USER_ID, 900);

      await expect(service.usePoint(USER_ID, 200)).rejects.toThrow(
        new InsufficientPointException('잔고가 부족합니다.'),
      );
    });
  });

  describe('충전과 사용을 연속으로 수행', () => {
    test('충전 후 사용이 정상적으로 동작한다', async () => {
      const chargeResult = await service.chargePoint(USER_ID, 1000);
      expect(chargeResult.point).toBe(1000);

      const useResult = await service.usePoint(USER_ID, 300);
      expect(useResult.point).toBe(700);
    });

    test('사용 후 충전이 정상적으로 동작한다', async () => {
      await userPointTable.insertOrUpdate(USER_ID, 500);

      const useResult = await service.usePoint(USER_ID, 200);
      expect(useResult.point).toBe(300);

      const chargeResult = await service.chargePoint(USER_ID, 800);
      expect(chargeResult.point).toBe(1100);
    });

    test('복합적인 충전/사용 시나리오', async () => {
      // 초기 충전
      await service.chargePoint(USER_ID, 1000);

      // 일부 사용
      await service.usePoint(USER_ID, 300);

      // 추가 충전
      await service.chargePoint(USER_ID, 500);

      // 더 많이 사용
      await service.usePoint(USER_ID, 800);

      // 최종 잔고 확인
      const finalPoint = await service.getPoint(USER_ID);
      expect(finalPoint.point).toBe(400);
    });
  });

  describe('서로 다른 사용자 간의 독립성', () => {
    test('서로 다른 사용자의 포인트는 독립적으로 관리된다', async () => {
      await service.chargePoint(USER_ID, 1000);
      await service.chargePoint(OTHER_USER_ID, 2000);

      const user1Point = await service.getPoint(USER_ID);
      const user2Point = await service.getPoint(OTHER_USER_ID);

      expect(user1Point.point).toBe(1000);
      expect(user2Point.point).toBe(2000);
    });

    test('한 사용자의 포인트 사용이 다른 사용자에게 영향을 주지 않는다', async () => {
      await service.chargePoint(USER_ID, 1000);
      await service.chargePoint(OTHER_USER_ID, 2000);

      await service.usePoint(USER_ID, 500);

      const user1Point = await service.getPoint(USER_ID);
      const user2Point = await service.getPoint(OTHER_USER_ID);

      expect(user1Point.point).toBe(500);
      expect(user2Point.point).toBe(2000);
    });
  });
});
