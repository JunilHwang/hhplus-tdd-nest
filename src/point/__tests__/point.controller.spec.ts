import { Test, TestingModule } from '@nestjs/testing';
import { PointController } from '../point.controller';
import { UserPointTable } from '../../database/userpoint.table';
import { PointHistoryTable } from '../../database/pointhistory.table';
import { PointBody } from '../point.dto';
import { PointService } from '../point.service';
import {
  InsufficientPointException,
  InvalidPointRequestException,
} from '../point.error';
import { TransactionType } from '../point.model';
import { PointHistoryService } from '../point-history.service';
import { PointFacade } from '../point.facade';

const USER_ID = 1;

const createPointBody = (amount: number): PointBody => {
  const point = new PointBody();
  point.amount = amount;
  return point;
};

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
      providers: [
        PointFacade,
        PointHistoryService,
        PointService,
        UserPointTable,
        PointHistoryTable,
      ],
    }).compile();

    controller = module.get(PointController);
    userPointTable = module.get(UserPointTable);
    pointHistoryTable = module.get(PointHistoryTable);
  });

  describe('포인트 충전', () => {
    test.each([
      { amount: -1000 },
      { amount: 0 },
      { amount: 0.1 },
      { amount: -0.5 },
      { amount: 'abc' },
      { amount: null },
      { amount: undefined },
      { amount: [] },
      { amount: {} },
      { amount: NaN },
    ])('$amount 로 충전을 시도하면 실패한다', async ({ amount }) => {
      const point = createPointBody(amount as never);

      await expect(controller.charge(USER_ID, point)).rejects.toThrow(
        new InvalidPointRequestException('충전 금액은 양의 정수여야 합니다.'),
      );
    });

    test.each([
      { name: '정수 금액', amount: 1000 },
      { name: '최대 정수 금액', amount: Number.MAX_SAFE_INTEGER },
      { name: '최소 양의 정수 금액', amount: 1 },
    ])(
      '양의 정수 $amount 으로 충전을 시도하면 성공한다',
      async ({ amount }) => {
        const point = createPointBody(amount);

        expect(await controller.charge(USER_ID, point)).toEqual({
          id: USER_ID,
          point: amount,
          updateMillis: expect.any(Number),
        });
      },
    );
  });

  describe('포인트 조회 > 유저 1의 포인트를 1000만큼 충전했을 때', () => {
    beforeEach(async () => {
      // USER_ID 유저의 포인트를 추가함
      await userPointTable.insertOrUpdate(USER_ID, 1000);
    });

    test('유저 2는 포인트가 업식 때문에 0으로 조회된다.', async () => {
      expect(await controller.point(2)).toEqual({
        id: 2,
        point: 0,
        updateMillis: expect.any(Number),
      });
    });

    test('유저 1의 포인트는 1000으로 조회된다.', async () => {
      expect(await controller.point(USER_ID)).toEqual({
        id: USER_ID,
        point: 1000,
        updateMillis: expect.any(Number),
      });
    });
  });

  describe('포인트 사용', () => {
    test.each([
      { amount: 0, usePoint: 100 },
      { amount: 100, usePoint: 101 },
    ])(
      '포인트가 $amount 만큼 있을 때, $usePoint 포인트를 사용하려고 하면 실패한다.',
      async ({ amount, usePoint: usePoint }) => {
        await userPointTable.insertOrUpdate(USER_ID, amount);
        const point = createPointBody(usePoint);

        await expect(controller.use(USER_ID, point)).rejects.toThrow(
          new InsufficientPointException('잔고가 부족합니다.'),
        );
      },
    );

    // 포인트를 사용하는 값은 양의 정수여야 함
    test.each([-100, 0, 0.1, -0.5, 'abc', null, undefined, [], {}, NaN])(
      '유효하지 않은 포인트(%s)를 사용하려고 하면 실패한다.',
      async (usePoint) => {
        const point = createPointBody(usePoint as never);

        await expect(controller.use(USER_ID, point)).rejects.toThrow(
          new InvalidPointRequestException('사용 금액은 양의 정수여야 합니다.'),
        );
      },
    );

    test('포인트 사용 시, 잔고가 충분하면 성공한다', async () => {
      // USER_ID 유저의 포인트를 1000으로 설정
      await userPointTable.insertOrUpdate(USER_ID, 1000);

      const point = createPointBody(500);

      expect(await controller.use(USER_ID, point)).toEqual({
        id: USER_ID,
        point: 500,
        updateMillis: expect.any(Number),
      });

      expect(await controller.use(USER_ID, point)).toEqual({
        id: USER_ID,
        point: 0,
        updateMillis: expect.any(Number),
      });
    });
  });

  describe('포인트 내역 조회', () => {
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
    test('포인트 내역이 없는 경우 빈 배열을 반환한다', async () => {
      expect(await controller.history(2)).toEqual([]);
    });

    test('포인트 내역이 있는 경우 해당 내역을 반환한다', async () => {
      const histories = await controller.history(USER_ID);
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
          amount: -500,
          type: TransactionType.USE,
          timeMillis: expect.any(Number),
        },
      ]);
    });
  });

  describe('동일한 유저가 포인트 충전을 한 번에 여러 번 하는 경우', () => {
    test('충전 요청이 순차적으로 처리되어야 한다', async () => {
      const point1 = createPointBody(1000);
      const point2 = createPointBody(2000);

      const charge1 = controller.charge(USER_ID, point1);
      const charge2 = controller.charge(USER_ID, point2);

      await expect(charge1).resolves.toEqual({
        id: USER_ID,
        point: 1000,
        updateMillis: expect.any(Number),
      });

      await expect(charge2).resolves.toEqual({
        id: USER_ID,
        point: 3000,
        updateMillis: expect.any(Number),
      });
    });

    test('동시에 여러 충전 요청이 모두 정상적으로 처리되어야 한다', async () => {
      const results = await Promise.all([
        controller.charge(USER_ID, createPointBody(100)),
        controller.charge(USER_ID, createPointBody(200)),
        controller.charge(USER_ID, createPointBody(300)),
        controller.charge(USER_ID, createPointBody(400)),
        controller.charge(USER_ID, createPointBody(500)),
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
        {
          id: USER_ID,
          point: 1000,
          updateMillis: expect.any(Number),
        },
        {
          id: USER_ID,
          point: 1500,
          updateMillis: expect.any(Number),
        },
      ]);
    });

    test('충전과 사용이 동시에 일어나도 순차적으로 처리되어야 한다', async () => {
      // 초기 포인트 설정
      await userPointTable.insertOrUpdate(USER_ID, 1000);

      const results = await Promise.all([
        controller.charge(USER_ID, createPointBody(500)),
        controller.use(USER_ID, createPointBody(200)),
        controller.charge(USER_ID, createPointBody(300)),
        controller.use(USER_ID, createPointBody(100)),
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
    });
  });
});
