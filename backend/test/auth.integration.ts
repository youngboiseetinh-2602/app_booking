import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
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
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  type UpdateResult,
} from 'typeorm';
import { AuthorizationGuard, Can, Policy } from '@nestjs/authorization';
import { AuthModule } from '../src/auth/auth.module';
import { AuthorizationModule } from '../src/authorization/authorization.module';
import type { AuthenticatedUser } from '../src/auth/interfaces/authenticated-user.interface';
import { Role } from '../src/common/enums/role.enum';
import { UserStatus } from '../src/common/enums/user-status.enum';
import { User } from '../src/users/entities/user.entity';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { BookingsModule } from '../src/bookings/bookings.module';
import { Booking } from '../src/bookings/entities/booking.entity';
import { BookingStatus } from '../src/common/enums/booking-status.enum';
import { ReviewsModule } from '../src/reviews/reviews.module';
import { Review } from '../src/reviews/entities/review.entity';
import { Hotel } from '../src/hotels/entities/hotel.entity';
import { HotelsModule } from '../src/hotels/hotels.module';
import { Room } from '../src/rooms/entities/room.entity';
import { RoomType } from '../src/room-types/entities/room-type.entity';
import { RoomStatus } from '../src/common/enums/room-status.enum';
import { HotelStatus } from '../src/common/enums/hotel-status.enum';

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
  let bookings: Booking[];
  let reviews: Review[];
  let savedUsers: User[];
  const bookingManager: EntityManager = new EntityManager(
    new DataSource({ type: 'postgres' }),
  );
  let bookingWrites: Booking[];
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

  function createBooking(
    id: string,
    ownerId: string,
    createdAt: string,
  ): Booking {
    const booking: Booking = new Booking();
    booking.id = id;
    booking.userId = ownerId;
    booking.roomId = '27ab2c50-c5c6-42cf-928a-140143c0d8f2';
    booking.guestCount = 2;
    booking.startTime = new Date('2026-12-01T03:00:00.000Z');
    booking.endTime = new Date('2026-12-01T05:00:00.000Z');
    booking.totalPrice = 200000;
    booking.status = BookingStatus.PENDING;
    booking.cancellationFee = 0;
    booking.createdAt = new Date(createdAt);
    booking.cancelledAt = null;
    return booking;
  }

  function createReview(id: string, ownerId: string, comment: string): Review {
    const review: Review = new Review();
    review.id = id;
    review.userId = ownerId;
    review.hotelId = '27ab2c50-c5c6-42cf-928a-140143c0d8f2';
    review.comment = comment;
    review.starRate = 5;
    Reflect.set(review, 'hotel', { name: 'The Aurora Hotel' });
    Reflect.set(review, 'user', {
      fullName: 'Test Customer',
      passwordHash: 'private-hash',
    });
    return review;
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
      imports: [
        AuthModule,
        AuthorizationModule,
        BookingsModule,
        ReviewsModule,
        HotelsModule,
      ],
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
      .overrideProvider(getRepositoryToken(Review))
      .useValue({
        find: (options: { where: { userId: string } }): Promise<Review[]> => {
          const result: Review[] = [];
          for (const review of reviews) {
            if (review.userId === options.where.userId) {
              result.push(review);
            }
          }
          return Promise.resolve(result);
        },
      })
      .overrideProvider(getRepositoryToken(Booking))
      .useValue({
        manager: {
          transaction: async (
            isolation: string,
            callback: (manager: EntityManager) => Promise<void>,
          ): Promise<void> => {
            assert.equal(isolation, 'READ COMMITTED');
            await callback(bookingManager);
          },
        },
        find: (options: { where: { userId: string } }): Promise<Booking[]> => {
          const result: Booking[] = [];
          for (const booking of bookings) {
            if (booking.userId === options.where.userId) {
              result.push(booking);
            }
          }
          return Promise.resolve(result);
        },
      })
      .overrideProvider(getRepositoryToken(Hotel))
      .useValue({
        existsBy: (where: { id: string }): Promise<boolean> =>
          Promise.resolve(where.id === '19b2d2b7-fb63-4b05-a290-25af17a76529'),
      })
      .overrideProvider(getRepositoryToken(User))
      .useValue({
        findOne: (options: {
          where: { username?: string; id?: string };
        }): Promise<User | null> =>
          Promise.resolve(
            currentUser &&
              (options.where.username === currentUser.username ||
                options.where.id === currentUser.id)
              ? currentUser
              : null,
          ),
        findOneBy: (where: { id: string }): Promise<User | null> => {
          lookups += 1;
          return Promise.resolve(
            currentUser?.id === where.id ? currentUser : null,
          );
        },
        exists: (): Promise<boolean> => Promise.resolve(false),
        create: (data: Partial<User>): User => Object.assign(new User(), data),
        save: (user: User): Promise<User> => {
          user.id = '302ea142-a4a8-4edb-945a-52130802e27b';
          savedUsers.push(user);
          return Promise.resolve(user);
        },
        update: (
          where: { id: string; status: UserStatus },
          changes: Partial<Pick<User, 'fullName' | 'email' | 'phone'>>,
        ): Promise<UpdateResult> => {
          if (changes.email === 'taken@example.com') {
            const error: Error & { code: string } = Object.assign(
              new Error('duplicate email'),
              { code: '23505' },
            );
            return Promise.reject(new QueryFailedError('UPDATE', [], error));
          }
          const affected: number =
            currentUser?.id === where.id && currentUser.status === where.status
              ? 1
              : 0;
          if (affected && currentUser) Object.assign(currentUser, changes);
          return Promise.resolve({ affected, raw: [], generatedMaps: [] });
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach((): void => {
    mock.restoreAll();
    currentUser = Object.assign(new User(), fixture);
    lookups = 0;
    savedUsers = [];
    bookingWrites = [];
    const room: Room = new Room();
    room.id = '27ab2c50-c5c6-42cf-928a-140143c0d8f2';
    room.roomTypeId = '19b2d2b7-fb63-4b05-a290-25af17a76529';
    room.status = RoomStatus.ACTIVE;
    const roomType: RoomType = new RoomType();
    roomType.isActive = true;
    roomType.hotelId = room.roomTypeId;
    roomType.capacity = 2;
    roomType.pricePerHour = 100000;
    const hotel: Hotel = new Hotel();
    hotel.status = HotelStatus.ACTIVE;
    bookingManager.getRepository(Room).findOne = (): Promise<Room> =>
      Promise.resolve(room);
    bookingManager.getRepository(RoomType).findOne = (): Promise<RoomType> =>
      Promise.resolve(roomType);
    bookingManager.getRepository(Hotel).findOne = (): Promise<Hotel> =>
      Promise.resolve(hotel);
    const bookingRepository = bookingManager.getRepository(Booking);
    bookingRepository.findOne = (options): Promise<Booking | null> => {
      const where = options.where;
      if (
        where === undefined ||
        Array.isArray(where) ||
        typeof where.id !== 'string'
      ) {
        throw new Error('Expected booking ID');
      }
      for (const booking of bookings) {
        if (booking.id === where.id) {
          return Promise.resolve(booking);
        }
      }
      return Promise.resolve(null);
    };
    mock.method(bookingRepository, 'create', (): Booking => new Booking());
    bookingRepository.exists = (): Promise<boolean> => Promise.resolve(false);
    bookingRepository.save = function save<T extends Booking>(
      booking: T,
    ): Promise<T> {
      bookingWrites.push(booking);
      return Promise.resolve(booking);
    };
    reviews = [
      createReview(
        '302ea142-a4a8-4edb-945a-52130802e27b',
        userId,
        'Phòng sạch, nhân viên thân thiện',
      ),
      createReview(
        '6646bca9-15c2-4279-b68f-a44016b80de8',
        '19b2d2b7-fb63-4b05-a290-25af17a76529',
        'Đánh giá của người khác',
      ),
    ];
    bookings = [
      createBooking(
        '302ea142-a4a8-4edb-945a-52130802e27b',
        userId,
        '2026-11-25T03:00:00.000Z',
      ),
      createBooking(
        '6646bca9-15c2-4279-b68f-a44016b80de8',
        '19b2d2b7-fb63-4b05-a290-25af17a76529',
        '2026-11-25T02:00:00.000Z',
      ),
      createBooking(
        'db8e22a2-65fa-47da-aab7-fc7c70f46be7',
        userId,
        '2026-11-25T01:00:00.000Z',
      ),
    ];
  });
  after(async (): Promise<void> => {
    if (app) await app.close();
  });

  const staffInput = {
    username: 'newstaff',
    password: 'Staff-password-123!',
    fullName: 'Nhân viên mới',
    email: 'staff@example.com',
    phone: '0901234567',
  };

  const bookingInput = {
    roomId: '27ab2c50-c5c6-42cf-928a-140143c0d8f2',
    guestCount: 2,
    startTime: '2099-12-01T03:00:00Z',
    endTime: '2099-12-01T04:30:00Z',
  };

  void it('allows staff to accept and reject pending bookings of their hotel', async (): Promise<void> => {
    assert.ok(currentUser);
    currentUser.role = Role.STAFF;
    currentUser.hotelId = '19b2d2b7-fb63-4b05-a290-25af17a76529';
    const token: string = sign({ sub: userId });
    await request(server)
      .patch(`/bookings/${bookings[0].id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: BookingStatus.ACCEPT })
      .expect(200)
      .expect('Cập nhật trạng thái booking thành công');
    assert.equal(bookings[0].status, BookingStatus.ACCEPT);
    assert.equal(bookings[0].cancelledAt, null);
    await request(server)
      .patch(`/bookings/${bookings[1].id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: BookingStatus.CANCEL })
      .expect(200);
    assert.equal(bookings[1].status, BookingStatus.CANCEL);
    assert.equal(bookings[1].cancellationFee, 0);
    assert.ok(bookings[1].cancelledAt instanceof Date);
    await request(server)
      .patch(`/bookings/${bookings[0].id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: BookingStatus.CANCEL })
      .expect(409);
    assert.equal(bookingWrites.length, 2);
  });

  void it('restricts status changes to active staff in the booking hotel', async (): Promise<void> => {
    const url: string = `/bookings/${bookings[0].id}/status`;
    await request(server)
      .patch(url)
      .send({ status: BookingStatus.ACCEPT })
      .expect(401);
    assert.ok(currentUser);
    const token: string = sign({ sub: userId, role: Role.STAFF });
    for (const role of [Role.CUSTOMER, Role.MANAGER, Role.ADMIN]) {
      currentUser.role = role;
      await request(server)
        .patch(url)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: BookingStatus.ACCEPT })
        .expect(403);
    }
    currentUser.role = Role.STAFF;
    currentUser.hotelId = null;
    await request(server)
      .patch(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: BookingStatus.ACCEPT })
      .expect(403);
    currentUser.hotelId = userId;
    await request(server)
      .patch(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: BookingStatus.ACCEPT })
      .expect(403);
    currentUser.status = UserStatus.INACTIVE;
    await request(server)
      .patch(url)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: BookingStatus.ACCEPT })
      .expect(401);
    assert.equal(bookingWrites.length, 0);
  });

  void it('validates status enum and booking ID', async (): Promise<void> => {
    assert.ok(currentUser);
    currentUser.role = Role.STAFF;
    currentUser.hotelId = '19b2d2b7-fb63-4b05-a290-25af17a76529';
    const token: string = sign({ sub: userId });
    const invalidInputs = [
      {},
      { status: null },
      { status: '' },
      { status: 1 },
      { status: BookingStatus.PENDING },
      { status: BookingStatus.EXPIRED },
      { status: 'accept' },
    ];
    for (const input of invalidInputs) {
      const response: request.Response = await request(server)
        .patch(`/bookings/${bookings[0].id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send(input)
        .expect(400);
      const body: unknown = response.body;
      assert.ok(typeof body === 'object' && body !== null);
      assert.ok('message' in body && typeof body.message === 'string');
    }
    await request(server)
      .patch('/bookings/invalid/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: BookingStatus.ACCEPT })
      .expect(400);
    await request(server)
      .patch(`/bookings/${userId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: BookingStatus.ACCEPT })
      .expect(404);
    assert.equal(bookingWrites.length, 0);
  });

  void it('updates only the status enum and ignores client supplied protected fields', async (): Promise<void> => {
    assert.ok(currentUser);
    currentUser.role = Role.STAFF;
    currentUser.hotelId = '19b2d2b7-fb63-4b05-a290-25af17a76529';
    const booking: Booking = bookings[0];
    const ownerId: string = booking.userId;
    const totalPrice: number = booking.totalPrice;
    await request(server)
      .patch(`/bookings/${booking.id}/status`)
      .set('Authorization', `Bearer ${sign({ sub: userId })}`)
      .send({
        status: BookingStatus.ACCEPT,
        userId: currentUser.hotelId,
        totalPrice: 0,
        cancellationFee: 100,
      })
      .expect(200);
    assert.equal(booking.status, BookingStatus.ACCEPT);
    assert.equal(booking.userId, ownerId);
    assert.equal(booking.totalPrice, totalPrice);
    assert.equal(booking.cancellationFee, 0);
  });

  void it('creates a pending booking with context ownership and server calculated price', async (): Promise<void> => {
    await request(server)
      .post('/bookings')
      .set('Authorization', `Bearer ${sign({ sub: userId })}`)
      .send(bookingInput)
      .expect(201)
      .expect('Tạo yêu cầu thành công, chờ thông báo từ khách sạn');
    assert.equal(bookingWrites.length, 1);
    assert.equal(bookingWrites[0].userId, userId);
    assert.equal(bookingWrites[0].totalPrice, 200000);
    assert.equal(bookingWrites[0].status, BookingStatus.PENDING);
  });

  void it('restricts booking creation to active customers using current roles', async (): Promise<void> => {
    await request(server).post('/bookings').send(bookingInput).expect(401);
    assert.ok(currentUser);
    for (const role of [Role.ADMIN, Role.MANAGER, Role.STAFF]) {
      currentUser.role = role;
      await request(server)
        .post('/bookings')
        .set(
          'Authorization',
          `Bearer ${sign({ sub: userId, role: Role.CUSTOMER })}`,
        )
        .send(bookingInput)
        .expect(403);
    }
    currentUser.role = Role.CUSTOMER;
    currentUser.status = UserStatus.INACTIVE;
    await request(server)
      .post('/bookings')
      .set('Authorization', `Bearer ${sign({ sub: userId })}`)
      .send(bookingInput)
      .expect(401);
    assert.equal(bookingWrites.length, 0);
  });

  void it('validates booking fields and rejects client supplied ownership, price and status', async (): Promise<void> => {
    const invalidInputs = [
      { ...bookingInput, roomId: '' },
      { ...bookingInput, roomId: 'invalid' },
      { ...bookingInput, guestCount: '2' },
      { ...bookingInput, guestCount: 0 },
      { ...bookingInput, guestCount: 3 },
      { ...bookingInput, startTime: 'invalid' },
      { ...bookingInput, startTime: '2099-12-01T03:00:00' },
      { ...bookingInput, endTime: bookingInput.startTime },
      { ...bookingInput, userId },
      { ...bookingInput, totalPrice: 0 },
      { ...bookingInput, status: BookingStatus.ACCEPT },
      { ...bookingInput, cancellationFee: 0 },
    ];
    for (const input of invalidInputs) {
      const response: request.Response = await request(server)
        .post('/bookings')
        .set('Authorization', `Bearer ${sign({ sub: userId })}`)
        .send(input)
        .expect(400);
      const body: unknown = response.body;
      assert.ok(typeof body === 'object' && body !== null);
      assert.ok('message' in body && typeof body.message === 'string');
    }
    assert.equal(bookingWrites.length, 0);
  });

  void it('returns conflict when the selected room is already reserved', async (): Promise<void> => {
    bookingManager.getRepository(Booking).exists = (): Promise<boolean> =>
      Promise.resolve(true);
    await request(server)
      .post('/bookings')
      .set('Authorization', `Bearer ${sign({ sub: userId })}`)
      .send(bookingInput)
      .expect(409);
    assert.equal(bookingWrites.length, 0);
  });

  void it('allows admins to create managers using RegisterDto and the selected hotel', async (): Promise<void> => {
    assert.ok(currentUser);
    currentUser.role = Role.ADMIN;
    const hotelId: string = '19b2d2b7-fb63-4b05-a290-25af17a76529';
    await request(server)
      .post(`/hotels/${hotelId}/managers`)
      .set('Authorization', `Bearer ${sign({ sub: userId })}`)
      .send(staffInput)
      .expect(201)
      .expect('Thêm manager thành công');
    assert.equal(savedUsers.length, 1);
    assert.equal(savedUsers[0].role, Role.MANAGER);
    assert.equal(savedUsers[0].status, UserStatus.ACTIVE);
    assert.equal(savedUsers[0].hotelId, hotelId);
    assert.equal(savedUsers[0].phone, staffInput.phone);
    assert.equal(
      await new PasswordHasher().verify(
        staffInput.password,
        savedUsers[0].passwordHash,
      ),
      true,
    );
  });

  void it('denies manager creation for other roles and stale admin tokens', async (): Promise<void> => {
    const url: string = '/hotels/19b2d2b7-fb63-4b05-a290-25af17a76529/managers';
    await request(server).post(url).send(staffInput).expect(401);
    assert.ok(currentUser);
    const token: string = sign({ sub: userId, role: Role.ADMIN });
    for (const role of [Role.MANAGER, Role.STAFF, Role.CUSTOMER]) {
      currentUser.role = role;
      await request(server)
        .post(url)
        .set('Authorization', `Bearer ${token}`)
        .send(staffInput)
        .expect(403);
    }
    currentUser.role = Role.ADMIN;
    currentUser.status = UserStatus.INACTIVE;
    await request(server)
      .post(url)
      .set('Authorization', `Bearer ${token}`)
      .send(staffInput)
      .expect(401);
    assert.equal(savedUsers.length, 0);
  });

  void it('rejects missing hotels, invalid hotel IDs and invalid manager bodies', async (): Promise<void> => {
    assert.ok(currentUser);
    currentUser.role = Role.ADMIN;
    const token: string = sign({ sub: userId });
    await request(server)
      .post('/hotels/302ea142-a4a8-4edb-945a-52130802e27b/managers')
      .set('Authorization', `Bearer ${token}`)
      .send(staffInput)
      .expect(404);
    await request(server)
      .post('/hotels/invalid/managers')
      .set('Authorization', `Bearer ${token}`)
      .send(staffInput)
      .expect(400);
    const invalidInputs = [
      { ...staffInput, fullName: '' },
      { ...staffInput, username: 123 },
      { ...staffInput, password: 'short' },
      { ...staffInput, email: 'invalid' },
      { ...staffInput, role: Role.ADMIN },
      { ...staffInput, status: UserStatus.INACTIVE },
      { ...staffInput, hotelId: userId },
    ];
    for (const input of invalidInputs) {
      await request(server)
        .post('/hotels/19b2d2b7-fb63-4b05-a290-25af17a76529/managers')
        .set('Authorization', `Bearer ${token}`)
        .send(input)
        .expect(400);
    }
    assert.equal(savedUsers.length, 0);
  });

  void it('allows only managers to create staff in their own hotel', async (): Promise<void> => {
    assert.ok(currentUser);
    currentUser.role = Role.MANAGER;
    currentUser.hotelId = '19b2d2b7-fb63-4b05-a290-25af17a76529';
    await request(server)
      .post('/users/staff')
      .set('Authorization', `Bearer ${sign({ sub: userId })}`)
      .send(staffInput)
      .expect(201)
      .expect('Thêm staff thành công');
    assert.equal(savedUsers.length, 1);
    assert.equal(savedUsers[0].role, Role.STAFF);
    assert.equal(savedUsers[0].status, UserStatus.ACTIVE);
    assert.equal(savedUsers[0].hotelId, currentUser.hotelId);
    assert.equal(
      await new PasswordHasher().verify(
        staffInput.password,
        savedUsers[0].passwordHash,
      ),
      true,
    );
  });

  void it('denies staff creation for every other role and stale manager token', async (): Promise<void> => {
    await request(server).post('/users/staff').send(staffInput).expect(401);
    assert.ok(currentUser);
    const token: string = sign({ sub: userId, role: Role.MANAGER });
    for (const role of [Role.CUSTOMER, Role.STAFF, Role.ADMIN]) {
      currentUser.role = role;
      await request(server)
        .post('/users/staff')
        .set('Authorization', `Bearer ${token}`)
        .send(staffInput)
        .expect(403);
    }
    currentUser.role = Role.MANAGER;
    currentUser.hotelId = null;
    await request(server)
      .post('/users/staff')
      .set('Authorization', `Bearer ${token}`)
      .send(staffInput)
      .expect(403);
    currentUser.hotelId = '19b2d2b7-fb63-4b05-a290-25af17a76529';
    currentUser.status = UserStatus.INACTIVE;
    await request(server)
      .post('/users/staff')
      .set('Authorization', `Bearer ${token}`)
      .send(staffInput)
      .expect(401);
    assert.equal(savedUsers.length, 0);
  });

  void it('validates staff DTO and rejects client supplied privileges and hotel', async (): Promise<void> => {
    assert.ok(currentUser);
    currentUser.role = Role.MANAGER;
    currentUser.hotelId = '19b2d2b7-fb63-4b05-a290-25af17a76529';
    const invalidInputs = [
      { ...staffInput, username: '' },
      { ...staffInput, fullName: 123 },
      { ...staffInput, password: 'short' },
      { ...staffInput, email: 'invalid' },
      { ...staffInput, role: Role.ADMIN },
      { ...staffInput, status: UserStatus.INACTIVE },
      { ...staffInput, hotelId: userId },
      { ...staffInput, passwordHash: 'client-hash' },
    ];
    for (const input of invalidInputs) {
      const response: request.Response = await request(server)
        .post('/users/staff')
        .set('Authorization', `Bearer ${sign({ sub: userId })}`)
        .send(input)
        .expect(400);
      const body: unknown = response.body;
      assert.ok(typeof body === 'object' && body !== null);
      assert.ok('message' in body && typeof body.message === 'string');
    }
    assert.equal(savedUsers.length, 0);
  });

  void it('returns only the current user reviews with hotel and reviewer names', async (): Promise<void> => {
    await request(server).get('/reviews/me').expect(401);
    const token: string = sign({ sub: userId });
    await request(server)
      .get('/reviews/me?userId=19b2d2b7-fb63-4b05-a290-25af17a76529')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([
        {
          hotelName: 'The Aurora Hotel',
          reviewerName: 'Test Customer',
          comment: 'Phòng sạch, nhân viên thân thiện',
          starRate: 5,
        },
      ]);
  });

  void it('returns 404 when only another user has reviews', async (): Promise<void> => {
    reviews = [
      createReview(
        '6646bca9-15c2-4279-b68f-a44016b80de8',
        '19b2d2b7-fb63-4b05-a290-25af17a76529',
        'Đánh giá của người khác',
      ),
    ];
    const token: string = sign({ sub: userId });
    const response: request.Response = await request(server)
      .get('/reviews/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    const body: unknown = response.body;
    assert.ok(typeof body === 'object' && body !== null);
    assert.ok('message' in body && body.message === 'Bạn chưa có đánh giá nào');
    assert.ok('path' in body && body.path === '/reviews/me');
  });

  void it('returns only the current user bookings and ignores a client supplied userId', async (): Promise<void> => {
    await request(server).get('/bookings/me').expect(401);
    const token: string = sign({ sub: userId });
    const response: request.Response = await request(server)
      .get('/bookings/me?userId=19b2d2b7-fb63-4b05-a290-25af17a76529')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body: unknown = response.body;
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 2);
    for (let index: number = 0; index < body.length; index++) {
      const item: unknown = body[index];
      assert.ok(typeof item === 'object' && item !== null);
      assert.ok('userId' in item && item.userId === userId);
      assert.ok(!('user' in item) && !('room' in item));
      assert.ok(!('passwordHash' in item));
    }
    const first: unknown = body[0];
    assert.ok(typeof first === 'object' && first !== null);
    assert.ok(
      'createdAt' in first && first.createdAt === '2026-11-25T03:00:00.000Z',
    );
  });

  void it('returns 404 if only another user has bookings', async (): Promise<void> => {
    bookings = [
      createBooking(
        '6646bca9-15c2-4279-b68f-a44016b80de8',
        '19b2d2b7-fb63-4b05-a290-25af17a76529',
        '2026-11-25T02:00:00.000Z',
      ),
    ];
    const token: string = sign({ sub: userId });
    const response: request.Response = await request(server)
      .get('/bookings/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    const body: unknown = response.body;
    assert.ok(typeof body === 'object' && body !== null);
    assert.ok('statusCode' in body && body.statusCode === 404);
    assert.ok('message' in body && body.message === 'Bạn chưa có booking nào');
    assert.ok('path' in body && body.path === '/bookings/me');
  });

  void it('returns the current profile from AuthenticationContext without accepting another user ID', async (): Promise<void> => {
    const token: string = sign({ sub: userId });
    await request(server)
      .get('/users/me?id=19b2d2b7-fb63-4b05-a290-25af17a76529')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({
        id: userId,
        username: fixture.username,
        fullName: fixture.fullName,
        email: fixture.email,
        phone: null,
        role: Role.CUSTOMER,
        status: UserStatus.ACTIVE,
        hotelId: null,
      });
    await request(server).get('/users/me').expect(401);
    assert.ok(currentUser);
    currentUser.status = UserStatus.INACTIVE;
    await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  void it('updates only the authenticated profile and returns the response DTO', async (): Promise<void> => {
    const token: string = sign({ sub: userId });
    await request(server)
      .patch('/users/me?id=19b2d2b7-fb63-4b05-a290-25af17a76529')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Tên mới',
        email: 'updated@example.com',
        phone: '0901234567',
      })
      .expect(200)
      .expect({
        id: userId,
        username: fixture.username,
        fullName: 'Tên mới',
        email: 'updated@example.com',
        phone: '0901234567',
        role: Role.CUSTOMER,
        status: UserStatus.ACTIVE,
        hotelId: null,
      });
    assert.ok(currentUser);
    assert.equal(currentUser.passwordHash, fixture.passwordHash);
    await request(server)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: null })
      .expect(200);
    assert.equal(currentUser.phone, null);
    assert.equal(currentUser.email, 'updated@example.com');
    assert.equal(currentUser.fullName, 'Tên mới');
  });

  void it('rejects empty, invalid and privileged profile update bodies with one error', async (): Promise<void> => {
    const token: string = sign({ sub: userId });
    const invalid: Record<string, unknown>[] = [
      {},
      { fullName: '' },
      { fullName: null },
      { fullName: '   ' },
      { fullName: 123 },
      { fullName: 'x'.repeat(101) },
      { email: null },
      { email: 'invalid' },
      { email: 'x'.repeat(256) },
      { phone: '' },
      { phone: 123 },
      { phone: '1'.repeat(16) },
      { role: Role.ADMIN },
      { status: UserStatus.INACTIVE },
      { hotelId: userId },
      { id: userId },
      { password: 'change-password' },
      { username: 'changed' },
    ];
    for (const body of invalid) {
      const response: request.Response = await request(server)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(400);
      const error: unknown = response.body;
      assert.ok(
        typeof error === 'object' && error !== null && 'message' in error,
      );
      assert.equal(typeof error.message, 'string');
    }
    assert.deepEqual(currentUser, fixture);
  });

  void it('returns 409 on duplicate profile email without altering the account', async (): Promise<void> => {
    const token: string = sign({ sub: userId });
    await request(server)
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'taken@example.com' })
      .expect(409);
    assert.deepEqual(currentUser, fixture);
  });

  void it('requires a valid token and an active account for profile updates', async (): Promise<void> => {
    await request(server)
      .patch('/users/me')
      .send({ fullName: 'Tên mới' })
      .expect(401);
    const expired: string = sign(
      { sub: userId },
      { now: (): number => Date.now() - 3600000 },
    );
    await request(server)
      .patch('/users/me')
      .set('Authorization', `Bearer ${expired}`)
      .send({ fullName: 'Tên mới' })
      .expect(401);
    assert.ok(currentUser);
    currentUser.status = UserStatus.INACTIVE;
    await request(server)
      .patch('/users/me')
      .set('Authorization', `Bearer ${sign({ sub: userId })}`)
      .send({ fullName: 'Tên mới' })
      .expect(401);
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
      .get('/users/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200)
      .expect({
        id: userId,
        username: fixture.username,
        fullName: fixture.fullName,
        email: fixture.email,
        phone: fixture.phone,
        role: Role.CUSTOMER,
        status: UserStatus.ACTIVE,
        hotelId: null,
      });
  });

  void it('returns 404 for the removed auth profile endpoint', async (): Promise<void> => {
    await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${sign({ sub: userId })}`)
      .expect(404);
  });

  void it('supports MANAGER accounts in tokens and profile responses', async (): Promise<void> => {
    assert.ok(currentUser);
    currentUser.role = Role.MANAGER;
    currentUser.hotelId = '19b2d2b7-fb63-4b05-a290-25af17a76529';

    const response: request.Response = await request(server)
      .post('/auth/login')
      .send({ username: fixture.username, password })
      .expect(200);
    const body: unknown = response.body;
    assert.ok(typeof body === 'object' && body !== null);
    assert.ok('accessToken' in body && typeof body.accessToken === 'string');

    const verifier: JwtVerifier = new JwtVerifier({
      key: testSecret,
      issuer: 'hotel-booking-api',
      audience: 'hotel-booking-client',
    });
    const claims: JwtClaims = await verifier.verify(body.accessToken);
    assert.equal(claims.role, Role.MANAGER);

    const profile: request.Response = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
    const profileBody: unknown = profile.body;
    assert.ok(typeof profileBody === 'object' && profileBody !== null);
    assert.ok('role' in profileBody && profileBody.role === Role.MANAGER);
    assert.ok(
      'hotelId' in profileBody && profileBody.hotelId === currentUser.hotelId,
    );
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
      .get('/users/me')
      .expect(401);
    const body: unknown = response.body;
    assert.ok(typeof body === 'object' && body !== null);
    assert.ok('statusCode' in body && body.statusCode === 401);
    assert.ok('path' in body && body.path === '/users/me');
    assert.ok('timestamp' in body && typeof body.timestamp === 'string');
    assert.ok('errorCode' in body && body.errorCode === 'missing_credentials');
    assert.match(String(response.headers['www-authenticate']), /^Bearer/);
    await request(server)
      .get('/users/me')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    const expired: string = sign(
      { sub: userId },
      { now: (): number => Date.now() - 3600000 },
    );
    await request(server)
      .get('/users/me')
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
        .get('/users/me')
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
        .get('/users/me')
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
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    currentUser = null;
    await request(server)
      .get('/users/me')
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
