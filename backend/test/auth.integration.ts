import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  Controller,
  Get,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import {
  JwtSigner,
  JwtVerifier,
  PasswordHasher,
  Public,
  Authenticate,
  type JwtClaims,
  type JwtSignerOptions,
} from '@nestjs/authentication';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthorizationGuard, Can, Policy } from '@nestjs/authorization';
import { AuthModule } from '../src/auth/auth.module';
import { AuthorizationModule } from '../src/authorization/authorization.module';
import type { AuthenticatedUser } from '../src/auth/interfaces/authenticated-user.interface';
import { Role } from '../src/common/enums/role.enum';
import { UserStatus } from '../src/common/enums/user-status.enum';
import { User } from '../src/users/entities/user.entity';
import { UsersService } from '../src/users/users.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

@Policy()
class AuthorizationTestPolicy {
  admin(user: AuthenticatedUser | null): boolean {
    return user?.role === Role.ADMIN;
  }

  staff(user: AuthenticatedUser | null): boolean {
    return user?.role === Role.STAFF || user?.role === Role.ADMIN;
  }
}

@Public()
@UseGuards(AuthorizationGuard)
@Controller('_auth-test')
class AuthorizationTestController {
  @Get('business')
  business(): string {
    return 'public business endpoint';
  }

  @Authenticate()
  @Can(AuthorizationTestPolicy, 'admin')
  @Get('admin')
  admin(): string {
    return 'admin only';
  }

  @Authenticate()
  @Can(AuthorizationTestPolicy, 'staff')
  @Get('staff')
  staff(): string {
    return 'staff or admin';
  }

  @Public()
  @Get('public')
  publicEndpoint(): string {
    return 'explicitly public';
  }
}

void describe('Library authentication with optional role authorization (no database)', (): void => {
  let app: INestApplication;
  let server: Server;
  let fixture: User;
  let currentUser: User | null;
  let lookups: number;
  const testSecret: string =
    'test-only-secret-never-use-in-production-123456789';
  const password: string = 'Test-password-123!';
  const userId: string = '8c1de0c4-d314-419b-9610-df2ba1677ae0';

  function sign(
    claims: JwtClaims,
    options: Partial<JwtSignerOptions> = {},
  ): string {
    return new JwtSigner({
      key: testSecret,
      issuer: 'hotel-booking-api',
      audience: 'hotel-booking-client',
      ttl: '30m',
      ...options,
    }).sign(claims);
  }

  before(async (): Promise<void> => {
    fixture = Object.assign(new User(), {
      id: userId,
      username: 'testcustomer',
      passwordHash: await new PasswordHasher().hash(password),
      fullName: 'Test Customer',
      email: 'customer@example.com',
      phone: null,
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
      hotelId: null,
    });
    const module: TestingModule = await Test.createTestingModule({
      imports: [AuthModule, AuthorizationModule],
      providers: [
        AuthorizationTestPolicy,
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
      controllers: [AuthorizationTestController],
    })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: (key: string): string => {
          assert.equal(key, 'JWT_SECRET');
          return testSecret;
        },
      })
      .overrideProvider(getRepositoryToken(User))
      .useValue({})
      .overrideProvider(UsersService)
      .useValue({
        findByUsernameWithPassword: (username: string): Promise<User | null> =>
          Promise.resolve(
            currentUser?.username === username ? currentUser : null,
          ),
        findById: (id: string): Promise<User | null> => {
          lookups += 1;
          return Promise.resolve(currentUser?.id === id ? currentUser : null);
        },
        register: (): Promise<string> => Promise.resolve('đăng kí thành công'),
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach((): void => {
    currentUser = Object.assign(new User(), fixture);
    lookups = 0;
  });
  after(async (): Promise<void> => {
    if (app) await app.close();
  });

  void it('issues a library JWT with exactly 30 minutes lifetime and no refresh token', async (): Promise<void> => {
    const response: request.Response = await request(server)
      .post('/auth/login')
      .send({ username: fixture.username, password })
      .expect(200);
    const body: unknown = response.body;
    assert.ok(typeof body === 'object' && body !== null);
    assert.ok('accessToken' in body && typeof body.accessToken === 'string');
    assert.ok('expiresIn' in body && body.expiresIn === 1800);
    assert.ok('tokenType' in body && body.tokenType === 'Bearer');
    assert.ok(!('passwordHash' in body) && !('refreshToken' in body));
    const verifier: JwtVerifier = new JwtVerifier({
      key: testSecret,
      issuer: 'hotel-booking-api',
      audience: 'hotel-booking-client',
    });
    const payload: JwtClaims = await verifier.verify(body.accessToken);
    assert.equal(payload.sub, userId);
    assert.equal(payload.role, Role.CUSTOMER);
    assert.ok(
      typeof payload.exp === 'number' && typeof payload.iat === 'number',
    );
    assert.equal(payload.exp - payload.iat, 1800);
    await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200)
      .expect({
        id: userId,
        username: fixture.username,
        role: Role.CUSTOMER,
        hotelId: null,
      });
  });

  void it('rejects wrong credentials, missing accounts and inactive accounts', async (): Promise<void> => {
    await request(server)
      .post('/auth/login')
      .send({ username: fixture.username, password: 'wrong-password' })
      .expect(401);
    await request(server)
      .post('/auth/login')
      .send({ username: 'missing', password })
      .expect(401);
    assert.ok(currentUser);
    currentUser.status = UserStatus.INACTIVE;
    await request(server)
      .post('/auth/login')
      .send({ username: fixture.username, password })
      .expect(401);
  });

  void it('validates input and rejects client supplied roles', async (): Promise<void> => {
    const missingPassword: request.Response = await request(server)
      .post('/auth/login')
      .send({ username: fixture.username })
      .expect(400);
    const body: unknown = missingPassword.body;
    assert.ok(typeof body === 'object' && body !== null && 'message' in body);
    assert.equal(body.message, 'Mật khẩu không được để trống');
    await request(server)
      .post('/auth/login')
      .send({ username: 123, password })
      .expect(400);
    await request(server)
      .post('/auth/login')
      .send({ username: fixture.username, password, role: Role.ADMIN })
      .expect(400);
  });

  void it('keeps business endpoints and registration public', async (): Promise<void> => {
    await request(server).get('/_auth-test/business').expect(200);
    await request(server).get('/_auth-test/public').expect(200);
    await request(server)
      .post('/users/register')
      .send({
        username: 'newcustomer',
        password,
        fullName: 'New Customer',
        email: 'new@example.com',
      })
      .expect(201)
      .expect('đăng kí thành công');
    assert.equal(lookups, 0);
  });

  void it('rejects missing, malformed and expired tokens', async (): Promise<void> => {
    const response: request.Response = await request(server)
      .get('/auth/me')
      .expect(401);
    const body: unknown = response.body;
    assert.ok(typeof body === 'object' && body !== null);
    assert.ok('statusCode' in body && body.statusCode === 401);
    assert.ok('path' in body && body.path === '/auth/me');
    assert.ok('timestamp' in body && typeof body.timestamp === 'string');
    assert.ok('errorCode' in body && body.errorCode === 'missing_credentials');
    assert.match(String(response.headers['www-authenticate']), /^Bearer/);
    await request(server)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    const expired: string = sign(
      { sub: userId },
      { now: (): number => Date.now() - 3600000 },
    );
    await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    assert.equal(lookups, 0);
  });

  void it('rejects wrong signatures, issuers, audiences and algorithms', async (): Promise<void> => {
    const tokens: string[] = [
      sign(
        { sub: userId },
        { key: 'another-secret-with-more-than-32-characters' },
      ),
      sign({ sub: userId }, { issuer: 'other-api' }),
      sign({ sub: userId }, { audience: 'other-client' }),
      sign({ sub: userId }, { alg: 'HS384' }),
    ];
    for (const token of tokens) {
      await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }
    assert.equal(lookups, 0);
  });

  void it('rejects missing expiration and invalid UUID subjects', async (): Promise<void> => {
    const header: string = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64url');
    const payload: string = Buffer.from(
      JSON.stringify({
        sub: userId,
        iss: 'hotel-booking-api',
        aud: 'hotel-booking-client',
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString('base64url');
    const unsigned: string = `${header}.${payload}`;
    const signature: string = createHmac('sha256', testSecret)
      .update(unsigned)
      .digest('base64url');
    const tokens: string[] = [
      `${unsigned}.${signature}`,
      sign({ sub: 'not-a-uuid' }),
    ];
    for (const token of tokens) {
      await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }
    assert.equal(lookups, 0);
  });

  void it('rejects inactive/deleted users with otherwise valid tokens', async (): Promise<void> => {
    const token: string = sign({ sub: userId });
    assert.ok(currentUser);
    currentUser.status = UserStatus.INACTIVE;
    await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    currentUser = null;
    await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  void it('checks current database roles instead of trusting stale token roles', async (): Promise<void> => {
    await request(server).get('/_auth-test/admin').expect(401);
    const token: string = sign({ sub: userId, role: Role.ADMIN });
    await request(server)
      .get('/_auth-test/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    assert.ok(currentUser);
    currentUser.role = Role.STAFF;
    await request(server)
      .get('/_auth-test/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(server)
      .get('/_auth-test/staff')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    currentUser.role = Role.ADMIN;
    await request(server)
      .get('/_auth-test/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  void it('rejects an invalid stored password hash', async (): Promise<void> => {
    assert.ok(currentUser);
    currentUser.passwordHash = 'invalid-hash';
    await request(server)
      .post('/auth/login')
      .send({ username: fixture.username, password })
      .expect(401);
  });
});
