import { Test, TestingModule } from '@nestjs/testing';
import { PointFacade } from '../point.facade';
import { PointService } from '../point.service';
import { PointHistoryService } from '../point-history.service';
import { UserPointTable } from '../../database/userpoint.table';
import { PointHistoryTable } from '../../database/pointhistory.table';
import { TransactionType } from '../point.model';
import { BadRequestException } from '@nestjs/common';

const USER_ID = 1;
const OTHER_USER_ID = 2;

describe('PointFacade > ', () => {
  let facade: PointFacade;
  let userPointTable: UserPointTable;
  let pointHistoryTable: PointHistoryTable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointFacade,
        PointService,
        PointHistoryService,
        UserPointTable,
        PointHistoryTable,
      ],
    }).compile();

    facade = module.get<PointFacade>(PointFacade);
    userPointTable = module.get<UserPointTable>(UserPointTable);
    pointHistoryTable = module.get<PointHistoryTable>(PointHistoryTable);
  });

  describe('getPoint > ', () => {
    beforeEach(async () => {
      await userPointTable.insertOrUpdate(USER_ID, 1000);
    });

    test('잘못된 형식의 사용자 ID는 예외를 발생시킨다', async () => {
      await expect(facade.getPoint(NaN)).rejects.toThrow(
        new BadRequestException('올바르지 않은 ID 값 입니다.'),
      );
    });

    test('사용자 포인트를 조회한다', async () => {
      const result = await facade.getPoint(USER_ID);

      expect(result).toEqual({
        id: USER_ID,
        point: 1000,
        updateMillis: expect.any(Number),
      });
    });

    test('존재하지 않는 사용자는 0 포인트로 조회된다', async () => {
      const result = await facade.getPoint(OTHER_USER_ID);

      expect(result).toEqual({
        id: OTHER_USER_ID,
        point: 0,
        updateMillis: expect.any(Number),
      });
    });
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
      const result = await facade.getPointHistory(USER_ID);

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
      const result = await facade.getPointHistory(OTHER_USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe('chargePoint > ', () => {
    test('포인트를 충전한다', async () => {
      const result = await facade.chargePoint(USER_ID, 1000);

      expect(result).toEqual({
        id: USER_ID,
        point: 1000,
        updateMillis: expect.any(Number),
      });

      // 히스토리가 기록되었는지 확인
      const histories = await facade.getPointHistory(USER_ID);
      expect(histories).toHaveLength(1);
      expect(histories[0]).toEqual({
        id: expect.any(Number),
        userId: USER_ID,
        amount: 1000,
        type: TransactionType.CHARGE,
        timeMillis: expect.any(Number),
      });
    });

    test('기존 포인트에 충전 금액을 추가한다', async () => {
      await userPointTable.insertOrUpdate(USER_ID, 500);

      const result = await facade.chargePoint(USER_ID, 1000);

      expect(result).toEqual({
        id: USER_ID,
        point: 1500,
        updateMillis: expect.any(Number),
      });
    });

    test('동시에 여러 충전 요청이 들어와도 순차적으로 처리된다', async () => {
      const results = await Promise.all([
        facade.chargePoint(USER_ID, 100),
        facade.chargePoint(USER_ID, 200),
        facade.chargePoint(USER_ID, 300),
      ]);

      expect(results).toEqual([
        {
          id: USER_ID,
          point: 100,
          updateMillis: expect.any(Number),
        },
        {
          id: USER_ID,
          point: 300,
          updateMillis: expect.any(Number),
        },
        {
          id: USER_ID,
          point: 600,
          updateMillis: expect.any(Number),
        },
      ]);

      // 히스토리도 3개 생성되었는지 확인
      const histories = await facade.getPointHistory(USER_ID);
      expect(histories).toHaveLength(3);
    });

    test('서로 다른 사용자의 충전은 동시에 처리된다', async () => {
      await Promise.all([
        facade.chargePoint(USER_ID, 1000),
        facade.chargePoint(OTHER_USER_ID, 2000),
      ]);

      const userPoint = await facade.getPoint(USER_ID);
      const otherUserPoint = await facade.getPoint(OTHER_USER_ID);

      expect(userPoint.point).toBe(1000);
      expect(otherUserPoint.point).toBe(2000);
    });
  });

  describe('usePoint > ', () => {
    beforeEach(async () => {
      await userPointTable.insertOrUpdate(USER_ID, 1000);
    });

    test('포인트를 사용한다', async () => {
      const result = await facade.usePoint(USER_ID, 500);

      expect(result).toEqual({
        id: USER_ID,
        point: 500,
        updateMillis: expect.any(Number),
      });

      // 히스토리가 기록되었는지 확인
      const histories = await facade.getPointHistory(USER_ID);
      expect(histories).toHaveLength(1);
      expect(histories[0]).toEqual({
        id: expect.any(Number),
        userId: USER_ID,
        amount: -500,
        type: TransactionType.USE,
        timeMillis: expect.any(Number),
      });
    });

    test('잔고가 부족하면 실패한다', async () => {
      await expect(facade.usePoint(USER_ID, 1500)).rejects.toThrow(
        '잔고가 부족합니다.',
      );
    });

    test('동시에 여러 사용 요청이 들어와도 순차적으로 처리된다', async () => {
      const results = await Promise.all([
        facade.usePoint(USER_ID, 100),
        facade.usePoint(USER_ID, 200),
        facade.usePoint(USER_ID, 300),
      ]);

      expect(results).toEqual([
        {
          id: USER_ID,
          point: 900,
          updateMillis: expect.any(Number),
        },
        {
          id: USER_ID,
          point: 700,
          updateMillis: expect.any(Number),
        },
        {
          id: USER_ID,
          point: 400,
          updateMillis: expect.any(Number),
        },
      ]);

      // 히스토리도 3개 생성되었는지 확인
      const histories = await facade.getPointHistory(USER_ID);
      expect(histories).toHaveLength(3);
    });

    test('충전과 사용이 동시에 일어나도 순차적으로 처리된다', async () => {
      const results = await Promise.all([
        facade.chargePoint(USER_ID, 500),
        facade.usePoint(USER_ID, 200),
        facade.chargePoint(USER_ID, 300),
        facade.usePoint(USER_ID, 100),
      ]);

      expect(results).toEqual([
        {
          id: USER_ID,
          point: 1500,
          updateMillis: expect.any(Number),
        },
        {
          id: USER_ID,
          point: 1300,
          updateMillis: expect.any(Number),
        },
        {
          id: USER_ID,
          point: 1600,
          updateMillis: expect.any(Number),
        },
        {
          id: USER_ID,
          point: 1500,
          updateMillis: expect.any(Number),
        },
      ]);

      // 히스토리도 4개 생성되었는지 확인
      const histories = await facade.getPointHistory(USER_ID);
      expect(histories).toHaveLength(4);
    });
  });

  describe('processWithQueue > ', () => {
    test('같은 사용자의 요청은 순차적으로 처리된다', async () => {
      const executionOrder: number[] = [];

      const operation1 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        executionOrder.push(1);
        return 'result1';
      };

      const operation2 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionOrder.push(2);
        return 'result2';
      };

      const operation3 = async () => {
        executionOrder.push(3);
        return 'result3';
      };

      // private 메서드를 테스트하기 위해 타입 단언 사용
      // 그런데 이렇게 해도 괜찮을까?
      const facade_: any = facade;

      const results = await Promise.all([
        facade_.processWithQueue(USER_ID, operation1),
        facade_.processWithQueue(USER_ID, operation2),
        facade_.processWithQueue(USER_ID, operation3),
      ]);

      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    test('서로 다른 사용자의 요청은 병렬로 처리된다 > ', async () => {
      const executionOrder: number[] = [];

      const operation1 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        executionOrder.push(1);
        return 'result1';
      };

      const operation2 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionOrder.push(2);
        return 'result2';
      };

      const facade_: any = facade;

      const promises = [
        facade_.processWithQueue(USER_ID, operation1),
        facade_.processWithQueue(OTHER_USER_ID, operation2),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual(['result1', 'result2']);
      expect(executionOrder).toEqual([2, 1]);
    });

    test('에러가 발생하면 다음 작업에 영향을 주지 않는다', async () => {
      const executionOrder: number[] = [];

      const operation1 = async () => {
        executionOrder.push(1);
        throw new Error('Test error');
      };

      const operation2 = async () => {
        executionOrder.push(2);
        return 'result2';
      };

      const facade_: any = facade;

      const promise1 = facade_.processWithQueue(USER_ID, operation1);
      const promise2 = facade_.processWithQueue(USER_ID, operation2);

      await expect(promise1).rejects.toThrow('Test error');
      // 현재 구현에서는 첫 번째 작업에서 에러가 발생하면 같은 큐의 다음 작업도 영향을 받음
      await expect(promise2).rejects.toThrow('Test error');

      expect(executionOrder).toEqual([1]);
    });
  });
});
