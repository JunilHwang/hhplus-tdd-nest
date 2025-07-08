import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TransactionType } from '../src/point/point.model';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('AppController', () => {
    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });
  });

  describe('PointController', () => {
    const USER_ID = 1;
    const OTHER_USER_ID = 2;

    describe('GET /point/:id', () => {
      it('존재하지 않는 사용자의 포인트를 조회하면 0을 반환한다', () => {
        return request(app.getHttpServer())
          .get(`/point/${USER_ID}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toEqual({
              id: USER_ID,
              point: 0,
              updateMillis: expect.any(Number),
            });
          });
      });

      it('포인트가 있는 사용자의 포인트를 정상적으로 조회한다', async () => {
        // 먼저 포인트를 충전
        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 1000 })
          .expect(200);

        // 포인트 조회
        return request(app.getHttpServer())
          .get(`/point/${USER_ID}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toEqual({
              id: USER_ID,
              point: 1000,
              updateMillis: expect.any(Number),
            });
          });
      });

      it('잘못된 사용자 ID 형식으로 요청하면 400 에러를 반환한다', () => {
        return request(app.getHttpServer())
          .get('/point/invalid-id')
          .expect(HttpStatus.BAD_REQUEST)
          .expect((res) => {
            expect(res.body).toEqual({
              error: 'Bad Request',
              message: '올바르지 않은 ID 값 입니다.',
              statusCode: HttpStatus.BAD_REQUEST,
            });
          });
      });
    });

    describe('PATCH /point/:id/charge', () => {
      it('포인트를 정상적으로 충전한다', () => {
        return request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 1000 })
          .expect(200)
          .expect((res) => {
            expect(res.body).toEqual({
              id: USER_ID,
              point: 1000,
              updateMillis: expect.any(Number),
            });
          });
      });

      it('기존 포인트에 추가로 충전한다', async () => {
        // 첫 번째 충전
        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 500 })
          .expect(200);

        // 두 번째 충전
        return request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 1000 })
          .expect(200)
          .expect((res) => {
            expect(res.body).toEqual({
              id: USER_ID,
              point: 1500,
              updateMillis: expect.any(Number),
            });
          });
      });

      it('최소 금액(1)으로 충전할 수 있다', () => {
        return request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 1 })
          .expect(200)
          .expect((res) => {
            expect(res.body.point).toBe(1);
          });
      });

      it.each([
        { amount: 0, description: '0' },
        { amount: -100, description: '음수' },
        { amount: 1.5, description: '소수' },
        { amount: 'abc', description: '문자열' },
        { amount: null, description: 'null' },
        { amount: undefined, description: 'undefined' },
      ])(
        '$description 금액으로 충전을 시도하면 400 에러를 반환한다',
        ({ amount }) => {
          return request(app.getHttpServer())
            .patch(`/point/${USER_ID}/charge`)
            .send({ amount })
            .expect(400);
        },
      );

      it('body가 없으면 400 에러를 반환한다', () => {
        return request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({})
          .expect(400);
      });

      it('잘못된 Content-Type으로 요청하면 400 에러를 반환한다', () => {
        return request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .set('Content-Type', 'text/plain')
          .send('invalid data')
          .expect(400);
      });
    });

    describe('PATCH /point/:id/use', () => {
      beforeEach(async () => {
        // 각 테스트 전에 사용자에게 충분한 포인트 제공
        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 1000 })
          .expect(200);
      });

      it('포인트를 정상적으로 사용한다', () => {
        return request(app.getHttpServer())
          .patch(`/point/${USER_ID}/use`)
          .send({ amount: 500 })
          .expect(200)
          .expect((res) => {
            expect(res.body).toEqual({
              id: USER_ID,
              point: 500,
              updateMillis: expect.any(Number),
            });
          });
      });

      it('모든 포인트를 사용할 수 있다', () => {
        return request(app.getHttpServer())
          .patch(`/point/${USER_ID}/use`)
          .send({ amount: 1000 })
          .expect(200)
          .expect((res) => {
            expect(res.body.point).toBe(0);
          });
      });

      it('최소 금액(1)으로 사용할 수 있다', () => {
        return request(app.getHttpServer())
          .patch(`/point/${USER_ID}/use`)
          .send({ amount: 1 })
          .expect(200)
          .expect((res) => {
            expect(res.body.point).toBe(999);
          });
      });

      it('잔고보다 많은 금액을 사용하려고 하면 400 에러를 반환한다', () => {
        return request(app.getHttpServer())
          .patch(`/point/${USER_ID}/use`)
          .send({ amount: 1500 })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toBe('잔고가 부족합니다.');
          });
      });

      it('잔고가 0인 사용자가 포인트를 사용하려고 하면 400 에러를 반환한다', () => {
        return request(app.getHttpServer())
          .patch(`/point/${OTHER_USER_ID}/use`)
          .send({ amount: 100 })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toBe('잔고가 부족합니다.');
          });
      });

      it.each([
        { amount: 0, description: '0' },
        { amount: -100, description: '음수' },
        { amount: 1.5, description: '소수' },
        { amount: 'abc', description: '문자열' },
        { amount: null, description: 'null' },
        { amount: undefined, description: 'undefined' },
      ])(
        '$description 금액으로 사용을 시도하면 400 에러를 반환한다',
        ({ amount }) => {
          return request(app.getHttpServer())
            .patch(`/point/${USER_ID}/use`)
            .send({ amount })
            .expect(400);
        },
      );
    });

    describe('GET /point/:id/histories', () => {
      it('내역이 없는 사용자는 빈 배열을 반환한다', () => {
        return request(app.getHttpServer())
          .get(`/point/${USER_ID}/histories`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toEqual([]);
          });
      });

      it('충전 내역이 정상적으로 조회된다', async () => {
        // 포인트 충전
        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 1000 })
          .expect(200);

        // 내역 조회
        return request(app.getHttpServer())
          .get(`/point/${USER_ID}/histories`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toEqual({
              id: expect.any(Number),
              userId: USER_ID,
              amount: 1000,
              type: TransactionType.CHARGE,
              timeMillis: expect.any(Number),
            });
          });
      });

      it('사용 내역이 정상적으로 조회된다', async () => {
        // 포인트 충전 후 사용
        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 1000 })
          .expect(200);

        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/use`)
          .send({ amount: 500 })
          .expect(200);

        // 내역 조회
        return request(app.getHttpServer())
          .get(`/point/${USER_ID}/histories`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveLength(2);
            expect(res.body[0]).toEqual({
              id: expect.any(Number),
              userId: USER_ID,
              amount: 1000,
              type: TransactionType.CHARGE,
              timeMillis: expect.any(Number),
            });
            expect(res.body[1]).toEqual({
              id: expect.any(Number),
              userId: USER_ID,
              amount: -500,
              type: TransactionType.USE,
              timeMillis: expect.any(Number),
            });
          });
      });

      it('복합적인 충전/사용 내역이 시간순으로 조회된다', async () => {
        // 복합적인 거래 수행
        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 1000 })
          .expect(200);

        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/use`)
          .send({ amount: 300 })
          .expect(200);

        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 500 })
          .expect(200);

        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/use`)
          .send({ amount: 200 })
          .expect(200);

        // 내역 조회
        return request(app.getHttpServer())
          .get(`/point/${USER_ID}/histories`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveLength(4);

            // 시간순으로 정렬되어 있는지 확인
            const times = res.body.map((h) => h.timeMillis);
            for (let i = 1; i < times.length; i++) {
              expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
            }

            // 각 거래 내역 확인
            expect(res.body[0].amount).toBe(1000);
            expect(res.body[0].type).toBe(TransactionType.CHARGE);
            expect(res.body[1].amount).toBe(-300);
            expect(res.body[1].type).toBe(TransactionType.USE);
            expect(res.body[2].amount).toBe(500);
            expect(res.body[2].type).toBe(TransactionType.CHARGE);
            expect(res.body[3].amount).toBe(-200);
            expect(res.body[3].type).toBe(TransactionType.USE);
          });
      });

      it('서로 다른 사용자의 내역은 독립적으로 조회된다', async () => {
        // 두 사용자가 각각 거래 수행
        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 1000 })
          .expect(200);

        await request(app.getHttpServer())
          .patch(`/point/${OTHER_USER_ID}/charge`)
          .send({ amount: 2000 })
          .expect(200);

        // 각 사용자 내역 조회
        const user1Response = await request(app.getHttpServer())
          .get(`/point/${USER_ID}/histories`)
          .expect(200);

        const user2Response = await request(app.getHttpServer())
          .get(`/point/${OTHER_USER_ID}/histories`)
          .expect(200);

        expect(user1Response.body).toHaveLength(1);
        expect(user1Response.body[0].amount).toBe(1000);
        expect(user1Response.body[0].userId).toBe(USER_ID);

        expect(user2Response.body).toHaveLength(1);
        expect(user2Response.body[0].amount).toBe(2000);
        expect(user2Response.body[0].userId).toBe(OTHER_USER_ID);
      });
    });

    describe('동시성 테스트', () => {
      it('동일한 사용자의 동시 충전 요청이 순차적으로 처리된다', async () => {
        const promises = [
          request(app.getHttpServer())
            .patch(`/point/${USER_ID}/charge`)
            .send({ amount: 100 }),
          request(app.getHttpServer())
            .patch(`/point/${USER_ID}/charge`)
            .send({ amount: 200 }),
          request(app.getHttpServer())
            .patch(`/point/${USER_ID}/charge`)
            .send({ amount: 300 }),
        ];

        const responses = await Promise.all(promises);

        // 모든 요청이 성공
        responses.forEach((res) => expect(res.status).toBe(200));

        // 순차 처리 결과 확인
        expect(responses[0].body.point).toBe(100);
        expect(responses[1].body.point).toBe(300);
        expect(responses[2].body.point).toBe(600);

        // 최종 포인트 확인
        const finalResponse = await request(app.getHttpServer())
          .get(`/point/${USER_ID}`)
          .expect(200);
        expect(finalResponse.body.point).toBe(600);
      });

      it('서로 다른 사용자의 동시 요청은 독립적으로 처리된다', async () => {
        const promises = [
          request(app.getHttpServer())
            .patch(`/point/${USER_ID}/charge`)
            .send({ amount: 1000 }),
          request(app.getHttpServer())
            .patch(`/point/${OTHER_USER_ID}/charge`)
            .send({ amount: 2000 }),
        ];

        const responses = await Promise.all(promises);

        // 모든 요청이 성공
        responses.forEach((res) => expect(res.status).toBe(200));

        // 각 사용자별 포인트 확인
        const user1Response = await request(app.getHttpServer())
          .get(`/point/${USER_ID}`)
          .expect(200);
        const user2Response = await request(app.getHttpServer())
          .get(`/point/${OTHER_USER_ID}`)
          .expect(200);

        expect(user1Response.body.point).toBe(1000);
        expect(user2Response.body.point).toBe(2000);
      });

      it('충전과 사용이 동시에 일어나도 순차적으로 처리된다', async () => {
        // 초기 포인트 설정
        await request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .send({ amount: 1000 })
          .expect(200);

        const promises = [
          request(app.getHttpServer())
            .patch(`/point/${USER_ID}/charge`)
            .send({ amount: 500 }),
          request(app.getHttpServer())
            .patch(`/point/${USER_ID}/use`)
            .send({ amount: 200 }),
          request(app.getHttpServer())
            .patch(`/point/${USER_ID}/charge`)
            .send({ amount: 300 }),
          request(app.getHttpServer())
            .patch(`/point/${USER_ID}/use`)
            .send({ amount: 100 }),
        ];

        const responses = await Promise.all(promises);

        // 모든 요청이 성공
        responses.forEach((res) => expect(res.status).toBe(200));

        // 순차 처리 결과 확인
        expect(responses[0].body.point).toBe(1500); // 1000 + 500
        expect(responses[1].body.point).toBe(1300); // 1500 - 200
        expect(responses[2].body.point).toBe(1600); // 1300 + 300
        expect(responses[3].body.point).toBe(1500); // 1600 - 100

        // 최종 포인트 확인
        const finalResponse = await request(app.getHttpServer())
          .get(`/point/${USER_ID}`)
          .expect(200);
        expect(finalResponse.body.point).toBe(1500);
      });
    });

    describe('에러 상황 테스트', () => {
      it('지원하지 않는 HTTP 메소드로 요청하면 405 에러를 반환한다', () => {
        return request(app.getHttpServer())
          .delete(`/point/${USER_ID}`)
          .expect(404); // NestJS에서는 404로 응답
      });

      it('잘못된 JSON 형식으로 요청하면 400 에러를 반환한다', () => {
        return request(app.getHttpServer())
          .patch(`/point/${USER_ID}/charge`)
          .set('Content-Type', 'application/json')
          .send('{"amount": invalid}')
          .expect(400);
      });
    });
  });
});
