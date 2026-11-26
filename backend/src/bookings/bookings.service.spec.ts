import { jest } from '@jest/globals';
import { AuthenticationContext } from '@nestjs/authentication';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  In,
  LessThan,
  MoreThan,
  Repository,
} from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../common/enums/role.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { BookingResponeDto } from './dto/bookingRespone.dto';
import type { Booking } from './entities/booking.entity';
import type { BookingsService } from './bookings.service';
import { BookingRequestDto } from './dto/bookingRequest.dto';
import type { Room } from '../rooms/entities/room.entity';
import type { RoomType } from '../room-types/entities/room-type.entity';
import type { Hotel } from '../hotels/entities/hotel.entity';
import { RoomStatus } from '../common/enums/room-status.enum';
import { HotelStatus } from '../common/enums/hotel-status.enum';

jest.unstable_mockModule('../rooms/entities/room.entity', () => ({
  Room: class Room {},
}));
jest.unstable_mockModule('../room-types/entities/room-type.entity', () => ({
  RoomType: class RoomType {},
}));
jest.unstable_mockModule('../hotels/entities/hotel.entity', () => ({
  Hotel: class Hotel {},
}));

jest.unstable_mockModule('./entities/booking.entity', () => ({
  Booking: class Booking {},
}));

describe('BookingsService.getMyBooking', (): void => {
  let service: BookingsService;
  let Service: typeof import('./bookings.service').BookingsService;
  let BookingEntity: typeof import('./entities/booking.entity').Booking;
  let RoomEntity: typeof import('../rooms/entities/room.entity').Room;
  let RoomTypeEntity: typeof import('../room-types/entities/room-type.entity').RoomType;
  let HotelEntity: typeof import('../hotels/entities/hotel.entity').Hotel;
  const find = jest.fn<Repository<Booking>['find']>();
  const context: AuthenticationContext<AuthenticatedUser> =
    new AuthenticationContext<AuthenticatedUser>();
  const currentUser: AuthenticatedUser = {
    id: '8c1de0c4-d314-419b-9610-df2ba1677ae0',
    username: 'customer',
    role: Role.CUSTOMER,
    hotelId: null,
  };

  beforeAll(async (): Promise<void> => {
    Service = (await import('./bookings.service.js')).BookingsService;
    BookingEntity = (await import('./entities/booking.entity.js')).Booking;
    RoomEntity = (await import('../rooms/entities/room.entity.js')).Room;
    RoomTypeEntity = (
      await import('../room-types/entities/room-type.entity.js')
    ).RoomType;
    HotelEntity = (await import('../hotels/entities/hotel.entity.js')).Hotel;
  });

  beforeEach((): void => {
    find.mockReset();
    find.mockResolvedValue([]);
    service = new Service({ find } as unknown as Repository<Booking>, context);
  });

  describe('createBooking', (): void => {
    let manager: EntityManager;
    let repository: Repository<Booking>;
    let room: Room;
    let roomType: RoomType;
    let hotel: Hotel;
    let saveBooking: jest.SpiedFunction<Repository<Booking>['save']>;
    let bookingExists: jest.SpiedFunction<Repository<Booking>['exists']>;
    let findRoom: jest.SpiedFunction<Repository<Room>['findOne']>;
    let transaction: jest.SpiedFunction<EntityManager['transaction']>;
    const dto: BookingRequestDto = {
      roomId: '27ab2c50-c5c6-42cf-928a-140143c0d8f2',
      guestCount: 2,
      startTime: '2099-12-01T03:00:00.000Z',
      endTime: '2099-12-01T04:30:00.000Z',
    };

    beforeEach((): void => {
      manager = new EntityManager(new DataSource({ type: 'postgres' }));
      repository = manager.getRepository(BookingEntity);
      room = new RoomEntity();
      room.id = dto.roomId;
      room.roomTypeId = 'room-type';
      room.status = RoomStatus.ACTIVE;
      roomType = new RoomTypeEntity();
      roomType.hotelId = 'hotel';
      roomType.isActive = true;
      roomType.capacity = 2;
      roomType.pricePerHour = 100000;
      hotel = new HotelEntity();
      hotel.status = HotelStatus.ACTIVE;
      findRoom = jest
        .spyOn(manager.getRepository(RoomEntity), 'findOne')
        .mockResolvedValue(room);
      jest
        .spyOn(manager.getRepository(RoomTypeEntity), 'findOne')
        .mockResolvedValue(roomType);
      jest
        .spyOn(manager.getRepository(HotelEntity), 'findOne')
        .mockResolvedValue(hotel);
      bookingExists = jest.spyOn(repository, 'exists').mockResolvedValue(false);
      jest.spyOn(repository, 'create').mockReturnValue(new BookingEntity());
      saveBooking = jest
        .spyOn(repository, 'save')
        .mockResolvedValue(new BookingEntity());
      transaction = jest
        .spyOn(manager, 'transaction')
        .mockImplementation(async (isolation, callback): Promise<unknown> => {
          if (typeof isolation === 'function' || callback === undefined) {
            throw new Error('Expected explicit transaction isolation');
          }
          return callback(manager);
        });
      service = new Service(repository, context);
    });

    function create(input: BookingRequestDto = dto): Promise<string> {
      return context.run({ user: currentUser }, (): Promise<string> =>
        service.createBooking(input),
      );
    }

    it('locks the room, bills rounded hours and saves only trusted fields', async (): Promise<void> => {
      await expect(create()).resolves.toBe(
        'Tạo yêu cầu thành công, chờ thông báo từ khách sạn',
      );
      expect(transaction).toHaveBeenCalledWith(
        'READ COMMITTED',
        expect.any(Function),
      );
      expect(findRoom).toHaveBeenCalledWith({
        where: { id: dto.roomId },
        lock: { mode: 'pessimistic_write' },
      });
      expect(saveBooking).toHaveBeenCalledTimes(1);
      expect(saveBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: currentUser.id,
          roomId: dto.roomId,
          guestCount: 2,
          totalPrice: 200000,
          status: BookingStatus.PENDING,
          cancellationFee: 0,
          cancelledAt: null,
        }),
      );
      expect(bookingExists).toHaveBeenCalledWith({
        where: {
          roomId: dto.roomId,
          status: In([BookingStatus.PENDING, BookingStatus.ACCEPT]),
          startTime: LessThan(new Date(dto.endTime)),
          endTime: MoreThan(new Date(dto.startTime)),
        },
      });
    });

    it('requires authentication', async (): Promise<void> => {
      await expect(service.createBooking(dto)).rejects.toThrow();
      expect(transaction).not.toHaveBeenCalled();
    });

    it.each([Role.ADMIN, Role.STAFF, Role.MANAGER])(
      'denies %s',
      async (role: Role): Promise<void> => {
        await expect(
          context.run({ user: { ...currentUser, role } }, (): Promise<string> =>
            service.createBooking(dto),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(transaction).not.toHaveBeenCalled();
      },
    );

    it.each([
      { ...dto, endTime: dto.startTime },
      { ...dto, endTime: '2099-12-01T02:00:00Z' },
      { ...dto, startTime: 'invalid' },
      { ...dto, startTime: '2000-01-01T00:00:00Z' },
    ])(
      'rejects invalid or past time ranges',
      async (input: BookingRequestDto): Promise<void> => {
        await expect(create(input)).rejects.toBeInstanceOf(BadRequestException);
        expect(saveBooking).not.toHaveBeenCalled();
      },
    );

    it('returns 404 for a missing room', async (): Promise<void> => {
      findRoom.mockResolvedValue(null);
      await expect(create()).rejects.toBeInstanceOf(NotFoundException);
      expect(saveBooking).not.toHaveBeenCalled();
    });

    it.each(['room', 'roomType', 'hotel'])(
      'rejects inactive %s',
      async (target: string): Promise<void> => {
        if (target === 'room') {
          room.status = RoomStatus.INACTIVE;
        }
        if (target === 'roomType') {
          roomType.isActive = false;
        }
        if (target === 'hotel') {
          hotel.status = HotelStatus.INACTIVE;
        }
        await expect(create()).rejects.toBeInstanceOf(BadRequestException);
        expect(saveBooking).not.toHaveBeenCalled();
      },
    );

    it.each([0, -1, 1.5, 3])(
      'rejects invalid guest count %s',
      async (guestCount: number): Promise<void> => {
        await expect(create({ ...dto, guestCount })).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(saveBooking).not.toHaveBeenCalled();
      },
    );

    it('rejects overlapping reservations', async (): Promise<void> => {
      bookingExists.mockResolvedValue(true);
      await expect(create()).rejects.toBeInstanceOf(ConflictException);
      expect(saveBooking).not.toHaveBeenCalled();
    });

    it('rejects price overflow', async (): Promise<void> => {
      roomType.pricePerHour = 2147483647;
      await expect(create()).rejects.toBeInstanceOf(BadRequestException);
      expect(saveBooking).not.toHaveBeenCalled();
    });

    it('propagates persistence failure through the transaction', async (): Promise<void> => {
      const error: Error = new Error('database unavailable');
      saveBooking.mockRejectedValue(error);
      await expect(create()).rejects.toBe(error);
    });

    describe('cancelMyBooking', (): void => {
      let booking: Booking;
      let findBooking: jest.SpiedFunction<Repository<Booking>['findOne']>;

      beforeEach((): void => {
        booking = new BookingEntity();
        booking.id = 'booking-id';
        booking.userId = currentUser.id;
        booking.roomId = room.id;
        booking.guestCount = 2;
        booking.startTime = new Date(dto.startTime);
        booking.endTime = new Date(dto.endTime);
        booking.totalPrice = 200000;
        booking.status = BookingStatus.PENDING;
        booking.cancellationFee = 0;
        booking.cancelledAt = null;
        booking.createdAt = new Date();
        findBooking = jest
          .spyOn(repository, 'findOne')
          .mockResolvedValue(booking);
        saveBooking.mockResolvedValue(booking);
      });

      function cancel(): Promise<BookingResponeDto> {
        return context.run(
          { user: currentUser },
          (): Promise<BookingResponeDto> => service.cancelMyBooking(booking.id),
        );
      }

      it('cancels an owned pending booking for free and returns only DTO fields', async (): Promise<void> => {
        Reflect.set(booking, 'user', { passwordHash: 'private-password-hash' });
        Reflect.set(booking, 'room', { id: booking.roomId });
        const response: BookingResponeDto = await cancel();

        expect(transaction).toHaveBeenCalledWith(
          'READ COMMITTED',
          expect.any(Function),
        );
        expect(findBooking).toHaveBeenCalledWith({
          where: { id: booking.id },
          lock: { mode: 'pessimistic_write' },
        });
        expect(saveBooking).toHaveBeenCalledTimes(1);
        expect(response).toBeInstanceOf(BookingResponeDto);
        expect(response).toMatchObject({
          id: booking.id,
          userId: currentUser.id,
          status: BookingStatus.CANCEL,
          totalPrice: 200000,
          cancellationFee: 0,
        });
        expect(response.cancelledAt).toBeInstanceOf(Date);
        expect(response).not.toHaveProperty('user');
        expect(response).not.toHaveProperty('room');
      });

      it.each([
        [200000, 60000],
        [100001, 30000],
        [100002, 30001],
        [0, 0],
      ])(
        'charges 30 percent of accepted price %s, rounded to %s',
        async (totalPrice: number, expectedFee: number): Promise<void> => {
          booking.status = BookingStatus.ACCEPT;
          booking.totalPrice = totalPrice;
          const response: BookingResponeDto = await cancel();

          expect(response.status).toBe(BookingStatus.CANCEL);
          expect(response.cancellationFee).toBe(expectedFee);
          expect(response.totalPrice).toBe(totalPrice);
          expect(response.cancelledAt).toBeInstanceOf(Date);
          expect(saveBooking).toHaveBeenCalledTimes(1);
        },
      );

      it('requires authentication before accessing the database', async (): Promise<void> => {
        await expect(service.cancelMyBooking(booking.id)).rejects.toThrow();
        expect(transaction).not.toHaveBeenCalled();
      });

      it('rejects another user booking without changing it', async (): Promise<void> => {
        booking.userId = 'another-user';
        await expect(cancel()).rejects.toBeInstanceOf(ForbiddenException);
        expect(saveBooking).not.toHaveBeenCalled();
        expect(booking.status).toBe(BookingStatus.PENDING);
        expect(booking.cancelledAt).toBeNull();
        expect(booking.cancellationFee).toBe(0);
      });

      it('rejects a missing booking', async (): Promise<void> => {
        findBooking.mockResolvedValue(null);
        await expect(cancel()).rejects.toBeInstanceOf(NotFoundException);
        expect(saveBooking).not.toHaveBeenCalled();
      });

      it.each([BookingStatus.CANCEL, BookingStatus.EXPIRED])(
        'rejects booking status %s without overwriting recorded fees',
        async (status: BookingStatus): Promise<void> => {
          booking.status = status;
          booking.cancellationFee = 60000;
          await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
          expect(saveBooking).not.toHaveBeenCalled();
          expect(booking.cancellationFee).toBe(60000);
        },
      );

      it('rejects repeated cancellation without charging again', async (): Promise<void> => {
        booking.status = BookingStatus.ACCEPT;
        await cancel();
        const cancelledAt: Date | null = booking.cancelledAt;
        await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
        expect(saveBooking).toHaveBeenCalledTimes(1);
        expect(booking.cancellationFee).toBe(60000);
        expect(booking.cancelledAt).toBe(cancelledAt);
      });

      it('propagates save failures through the transaction', async (): Promise<void> => {
        const error: Error = new Error('Database unavailable');
        saveBooking.mockRejectedValue(error);
        await expect(cancel()).rejects.toBe(error);
      });
    });

    describe('updateBookingStatus', (): void => {
      let booking: Booking;
      let findBooking: jest.SpiedFunction<Repository<Booking>['findOne']>;
      const staff: AuthenticatedUser = {
        id: 'staff-id',
        username: 'staff',
        role: Role.STAFF,
        hotelId: 'hotel',
      };

      beforeEach((): void => {
        booking = new BookingEntity();
        booking.id = 'booking-id';
        booking.roomId = room.id;
        booking.userId = currentUser.id;
        booking.status = BookingStatus.PENDING;
        booking.totalPrice = 200000;
        booking.cancellationFee = 0;
        booking.cancelledAt = null;
        findBooking = jest
          .spyOn(repository, 'findOne')
          .mockResolvedValue(booking);
      });

      function update(status: BookingStatus): Promise<string> {
        return context.run({ user: staff }, (): Promise<string> =>
          service.updateBookingStatus(booking.id, status),
        );
      }

      it('accepts pending booking without changing its price or owner', async (): Promise<void> => {
        await expect(update(BookingStatus.ACCEPT)).resolves.toBe(
          'Cập nhật trạng thái booking thành công',
        );
        expect(findBooking).toHaveBeenCalledWith({
          where: { id: booking.id },
          lock: { mode: 'pessimistic_write' },
        });
        expect(saveBooking).toHaveBeenCalledTimes(1);
        expect(booking.status).toBe(BookingStatus.ACCEPT);
        expect(booking.userId).toBe(currentUser.id);
        expect(booking.totalPrice).toBe(200000);
        expect(booking.cancelledAt).toBeNull();
      });

      it('cancels pending booking with a timestamp and no customer cancellation fee', async (): Promise<void> => {
        await update(BookingStatus.CANCEL);
        expect(booking.status).toBe(BookingStatus.CANCEL);
        expect(booking.cancelledAt).toBeInstanceOf(Date);
        expect(booking.cancellationFee).toBe(0);
        expect(booking.totalPrice).toBe(200000);
      });

      it('requires authentication', async (): Promise<void> => {
        await expect(
          service.updateBookingStatus(booking.id, BookingStatus.ACCEPT),
        ).rejects.toThrow();
        expect(transaction).not.toHaveBeenCalled();
      });

      it.each([Role.CUSTOMER, Role.MANAGER, Role.ADMIN])(
        'rejects role %s',
        async (role: Role): Promise<void> => {
          await expect(
            context.run({ user: { ...staff, role } }, (): Promise<string> =>
              service.updateBookingStatus(booking.id, BookingStatus.ACCEPT),
            ),
          ).rejects.toBeInstanceOf(ForbiddenException);
          expect(transaction).not.toHaveBeenCalled();
        },
      );

      it('rejects staff without an assigned hotel', async (): Promise<void> => {
        await expect(
          context.run(
            { user: { ...staff, hotelId: null } },
            (): Promise<string> =>
              service.updateBookingStatus(booking.id, BookingStatus.ACCEPT),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(transaction).not.toHaveBeenCalled();
      });

      it('rejects bookings from another hotel before saving', async (): Promise<void> => {
        roomType.hotelId = 'another-hotel';
        await expect(update(BookingStatus.ACCEPT)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(saveBooking).not.toHaveBeenCalled();
      });

      it('rejects missing bookings', async (): Promise<void> => {
        findBooking.mockResolvedValue(null);
        await expect(update(BookingStatus.ACCEPT)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(saveBooking).not.toHaveBeenCalled();
      });

      it.each([BookingStatus.PENDING, BookingStatus.EXPIRED])(
        'rejects requested status %s',
        async (status: BookingStatus): Promise<void> => {
          await expect(update(status)).rejects.toBeInstanceOf(
            BadRequestException,
          );
          expect(transaction).not.toHaveBeenCalled();
        },
      );

      it.each([
        BookingStatus.ACCEPT,
        BookingStatus.CANCEL,
        BookingStatus.EXPIRED,
      ])(
        'rejects processed booking %s',
        async (status: BookingStatus): Promise<void> => {
          booking.status = status;
          await expect(update(BookingStatus.ACCEPT)).rejects.toBeInstanceOf(
            ConflictException,
          );
          expect(saveBooking).not.toHaveBeenCalled();
        },
      );

      it('propagates save failures', async (): Promise<void> => {
        const error: Error = new Error('Database unavailable');
        saveBooking.mockRejectedValue(error);
        await expect(update(BookingStatus.ACCEPT)).rejects.toBe(error);
      });
    });
  });

  it('requires a signed-in user before querying bookings', async (): Promise<void> => {
    await expect(service.getMyBooking()).rejects.toThrow();
    expect(find).not.toHaveBeenCalled();
  });

  it('returns 404 when the current user has no bookings', async (): Promise<void> => {
    await expect(
      context.run({ user: currentUser }, (): Promise<BookingResponeDto[]> =>
        service.getMyBooking(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(find).toHaveBeenCalledWith({
      where: { userId: currentUser.id },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  });

  it('returns DTOs in repository order without user or room relations', async (): Promise<void> => {
    const booking: Booking = new BookingEntity();
    booking.id = '19b2d2b7-fb63-4b05-a290-25af17a76529';
    booking.userId = currentUser.id;
    booking.roomId = '27ab2c50-c5c6-42cf-928a-140143c0d8f2';
    booking.guestCount = 2;
    booking.startTime = new Date('2026-12-01T03:00:00.000Z');
    booking.endTime = new Date('2026-12-01T05:00:00.000Z');
    booking.totalPrice = 200000;
    booking.status = BookingStatus.CANCEL;
    booking.cancellationFee = 20000;
    booking.createdAt = new Date('2026-11-25T01:00:00.000Z');
    booking.cancelledAt = new Date('2026-11-25T02:00:00.000Z');
    // Relation có dữ liệu nhạy cảm cũng không được mapper sao chép sang DTO.
    Reflect.set(booking, 'user', { passwordHash: 'private-password-hash' });
    Reflect.set(booking, 'room', { id: booking.roomId });
    find.mockResolvedValue([booking]);

    const responses: BookingResponeDto[] = await context.run(
      { user: currentUser },
      (): Promise<BookingResponeDto[]> => service.getMyBooking(),
    );
    expect(responses).toHaveLength(1);
    expect(responses[0]).toBeInstanceOf(BookingResponeDto);
    expect(responses[0]).toMatchObject({
      id: booking.id,
      userId: booking.userId,
      roomId: booking.roomId,
      guestCount: booking.guestCount,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: booking.totalPrice,
      status: booking.status,
      cancellationFee: booking.cancellationFee,
      createdAt: booking.createdAt,
      cancelledAt: booking.cancelledAt,
    });
    expect(responses[0]).not.toHaveProperty('user');
    expect(responses[0]).not.toHaveProperty('room');
  });

  it('propagates database failures instead of treating them as an empty list', async (): Promise<void> => {
    const error: Error = new Error('Database unavailable');
    find.mockRejectedValue(error);
    await expect(
      context.run({ user: currentUser }, (): Promise<BookingResponeDto[]> =>
        service.getMyBooking(),
      ),
    ).rejects.toBe(error);
  });
});
