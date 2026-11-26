import { ConflictException, INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationGuard } from '@nestjs/authorization';
import request from 'supertest';
import type { Server } from 'node:http';
import type { UsersService } from './users.service';

jest.unstable_mockModule('./entities/user.entity', () => ({
  User: class User {},
}));

jest.unstable_mockModule('../hotels/entities/hotel.entity', () => ({
  Hotel: class Hotel {},
}));

describe('POST /users/register', (): void => {
  let app: INestApplication;
  const register = jest.fn<UsersService['register']>();
  const body: Record<string, string> = {
    username: 'customer',
    password: 'test-password-123',
    fullName: 'Khách hàng',
    email: 'customer@example.com',
  };

  beforeAll(async (): Promise<void> => {
    const { UsersController } = await import('./users.controller.js');
    const { UsersService } = await import('./users.service.js');
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { register } }],
    })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: (): boolean => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach((): void => {
    register.mockReset();
    register.mockResolvedValue('đăng kí thành công');
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  it('returns the success string and HTTP 201', async (): Promise<void> => {
    await request(app.getHttpServer() as Server)
      .post('/users/register')
      .send(body)
      .expect(201)
      .expect('đăng kí thành công');
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid input before calling the service', async (): Promise<void> => {
    await request(app.getHttpServer() as Server)
      .post('/users/register')
      .send({ ...body, email: 'invalid', password: 'short' })
      .expect(400);
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects client supplied privileges', async (): Promise<void> => {
    await request(app.getHttpServer() as Server)
      .post('/users/register')
      .send({ ...body, role: 'ADMIN', status: 'ACTIVE', hotelId: null })
      .expect(400);
    expect(register).not.toHaveBeenCalled();
  });

  it('returns HTTP 409 for duplicates', async (): Promise<void> => {
    register.mockRejectedValue(
      new ConflictException('Tên đăng nhập hoặc email đã tồn tại'),
    );
    await request(app.getHttpServer() as Server)
      .post('/users/register')
      .send(body)
      .expect(409);
  });
});
