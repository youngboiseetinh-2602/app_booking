import { jest } from '@jest/globals';
import assert from 'node:assert/strict';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Logger,
  Post,
  UnauthorizedException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { RegisterDto } from '../../users/dto/register.dto';
import { GlobalExceptionFilter } from './global-exception.filter';

function timestampOf(body: unknown): string {
  assert.ok(typeof body === 'object' && body !== null && 'timestamp' in body);
  assert.ok(typeof body.timestamp === 'string');
  assert.equal(new Date(body.timestamp).toISOString(), body.timestamp);
  return body.timestamp;
}

@Controller('errors')
class ErrorTestController {
  @Get('conflict')
  conflict(): never {
    throw new ConflictException('Email đã tồn tại');
  }

  @Get('string')
  stringResponse(): never {
    throw new HttpException('Thông tin không hợp lệ', 400);
  }

  @Get('unauthorized')
  unauthorized(): never {
    throw new UnauthorizedException('Token hết hạn', {
      errorCode: 'token_expired',
    });
  }

  @Get('internal')
  internal(): never {
    throw new Error('Database password=secret; SELECT * FROM users');
  }

  @Get('http-internal')
  httpInternal(): never {
    throw new InternalServerErrorException('Private database details');
  }

  @Get('middleware')
  middleware(): never {
    throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
  }

  @Post('validate')
  validate(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RegisterDto,
  ): string {
    return dto.username;
  }
}

describe('GlobalExceptionFilter HTTP responses', (): void => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async (): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ErrorTestController],
      providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  it('preserves conflicts and adds a timestamp and path without query parameters', async (): Promise<void> => {
    const response: request.Response = await request(server)
      .get('/errors/conflict?token=hidden')
      .expect(409);
    expect(response.body).toEqual({
      statusCode: 409,
      message: 'Email đã tồn tại',
      path: '/errors/conflict',
      timestamp: timestampOf(response.body),
    });
    expect(response.text).not.toContain('hidden');
  });

  it('preserves a plain string HttpException response', async (): Promise<void> => {
    const response: request.Response = await request(server)
      .get('/errors/string')
      .expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      message: 'Thông tin không hợp lệ',
    });
  });

  it('preserves authentication error codes', async (): Promise<void> => {
    const response: request.Response = await request(server)
      .get('/errors/unauthorized')
      .expect(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Token hết hạn',
      errorCode: 'token_expired',
    });
  });

  it('preserves validation messages as an array', async (): Promise<void> => {
    const response: request.Response = await request(server)
      .post('/errors/validate')
      .send({ username: 'ab' })
      .expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      path: '/errors/validate',
    });
    const body: unknown = response.body;
    assert.ok(typeof body === 'object' && body !== null && 'message' in body);
    assert.ok(Array.isArray(body.message) && body.message.length > 0);
    assert.ok(
      body.message.every(
        (message: unknown): boolean => typeof message === 'string',
      ),
    );
  });

  it('normalizes missing route errors', async (): Promise<void> => {
    const response: request.Response = await request(server)
      .get('/missing')
      .expect(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      path: '/missing',
      timestamp: timestampOf(response.body),
    });
  });

  it.each(['/errors/internal', '/errors/http-internal'])(
    'hides internal details at %s and logs the failure',
    async (path: string): Promise<void> => {
      const logger = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation((): void => undefined);
      try {
        const response: request.Response = await request(server)
          .get(path)
          .expect(500);
        expect(response.body).toEqual({
          statusCode: 500,
          message: 'Internal server error',
          path,
          timestamp: timestampOf(response.body),
        });
        expect(logger).toHaveBeenCalled();
        expect(response.text).not.toMatch(
          /password|secret|SELECT|database|stack/i,
        );
      } finally {
        logger.mockRestore();
      }
    },
  );

  it('preserves HTTP status errors from Express middleware', async (): Promise<void> => {
    const response: request.Response = await request(server)
      .get('/errors/middleware')
      .expect(413);
    expect(response.body).toMatchObject({
      statusCode: 413,
      message: 'Payload too large',
    });
  });
});
