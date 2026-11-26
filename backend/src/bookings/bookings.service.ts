import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  LessThan,
  MoreThan,
  Repository,
  type EntityManager,
} from 'typeorm';
import { plainToInstance } from 'class-transformer';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Booking } from './entities/booking.entity';
import { BookingResponeDto } from './dto/bookingRespone.dto';
import { BookingRequestDto } from './dto/bookingRequest.dto';
import { Role } from '../common/enums/role.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { RoomStatus } from '../common/enums/room-status.enum';
import { HotelStatus } from '../common/enums/hotel-status.enum';
import { Room } from '../rooms/entities/room.entity';
import { RoomType } from '../room-types/entities/room-type.entity';
import { Hotel } from '../hotels/entities/hotel.entity';

@Injectable()
export class BookingsService {
  private readonly acceptedCancellationFeePercent: number = 30;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    private readonly authenticationContext: AuthenticationContext<AuthenticatedUser>,
  ) {}

  async createBooking(dto: BookingRequestDto): Promise<string> {
    const currentUser: AuthenticatedUser =
      this.authenticationContext.requireUser();
    if (currentUser.role !== Role.CUSTOMER) {
      throw new ForbiddenException('Chỉ customer mới được phép đặt phòng');
    }

    const startTime: Date = new Date(dto.startTime);
    const endTime: Date = new Date(dto.endTime);
    if (
      !Number.isFinite(startTime.getTime()) ||
      !Number.isFinite(endTime.getTime()) ||
      endTime.getTime() <= startTime.getTime()
    ) {
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu',
      );
    }
    if (startTime.getTime() <= Date.now()) {
      throw new BadRequestException('Thời gian bắt đầu phải ở tương lai');
    }

    await this.bookingsRepository.manager.transaction(
      'READ COMMITTED',
      async (manager: EntityManager): Promise<void> => {
        // Khóa phòng trước khi kiểm tra lịch để các request cùng phòng chờ nhau.
        const room: Room | null = await manager.getRepository(Room).findOne({
          where: { id: dto.roomId },
          lock: { mode: 'pessimistic_write' },
        });
        if (room === null) {
          throw new NotFoundException('Không tìm thấy phòng');
        }
        if (room.status !== RoomStatus.ACTIVE) {
          throw new BadRequestException('Phòng không hoạt động');
        }

        const roomType: RoomType | null = await manager
          .getRepository(RoomType)
          .findOne({
            where: { id: room.roomTypeId },
            lock: { mode: 'pessimistic_read' },
          });
        if (roomType === null || !roomType.isActive) {
          throw new BadRequestException('Loại phòng không hoạt động');
        }
        const hotel: Hotel | null = await manager.getRepository(Hotel).findOne({
          where: { id: roomType.hotelId },
          lock: { mode: 'pessimistic_read' },
        });
        if (hotel === null || hotel.status !== HotelStatus.ACTIVE) {
          throw new BadRequestException('Khách sạn không hoạt động');
        }
        if (
          !Number.isInteger(dto.guestCount) ||
          dto.guestCount < 1 ||
          dto.guestCount > roomType.capacity
        ) {
          throw new BadRequestException(
            'Số khách phải lớn hơn 0 và không vượt sức chứa của loại phòng',
          );
        }

        const repository: Repository<Booking> = manager.getRepository(Booking);
        await this.checkBookingOverlap(repository, room.id, startTime, endTime);
        if (startTime.getTime() <= Date.now()) {
          throw new BadRequestException('Thời gian bắt đầu phải ở tương lai');
        }

        const durationMilliseconds: number =
          endTime.getTime() - startTime.getTime();
        const billedHours: number = Math.ceil(durationMilliseconds / 3600000);
        const totalPrice: number = billedHours * roomType.pricePerHour;
        if (
          !Number.isSafeInteger(totalPrice) ||
          totalPrice < 0 ||
          totalPrice > 2147483647
        ) {
          throw new BadRequestException('Tổng tiền vượt giới hạn cho phép');
        }

        const booking: Booking = repository.create({});
        booking.userId = currentUser.id;
        booking.roomId = room.id;
        booking.guestCount = dto.guestCount;
        booking.startTime = startTime;
        booking.endTime = endTime;
        booking.totalPrice = totalPrice;
        booking.status = BookingStatus.PENDING;
        booking.cancellationFee = 0;
        booking.cancelledAt = null;
        await repository.save(booking);
      },
    );

    return 'Tạo yêu cầu thành công, chờ thông báo từ khách sạn';
  }

  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
  ): Promise<string> {
    const staff: AuthenticatedUser = this.authenticationContext.requireUser();
    if (staff.role !== Role.STAFF || staff.hotelId === null) {
      throw new ForbiddenException(
        'Chỉ staff được phân công khách sạn mới được xử lý booking',
      );
    }
    if (status !== BookingStatus.ACCEPT && status !== BookingStatus.CANCEL) {
      throw new BadRequestException(
        'Trạng thái chỉ được là ACCEPT hoặc CANCEL',
      );
    }

    await this.bookingsRepository.manager.transaction(
      'READ COMMITTED',
      async (manager: EntityManager): Promise<void> => {
        const repository: Repository<Booking> = manager.getRepository(Booking);
        // Khóa booking để hai staff không thể xử lý cùng một yêu cầu đồng thời.
        const booking: Booking | null = await repository.findOne({
          where: { id: bookingId },
          lock: { mode: 'pessimistic_write' },
        });
        if (booking === null) {
          throw new NotFoundException('Không tìm thấy booking');
        }

        const room: Room | null = await manager.getRepository(Room).findOne({
          where: { id: booking.roomId },
          lock: { mode: 'pessimistic_read' },
        });
        if (room === null) {
          throw new NotFoundException('Không tìm thấy phòng');
        }
        const roomType: RoomType | null = await manager
          .getRepository(RoomType)
          .findOne({
            where: { id: room.roomTypeId },
            lock: { mode: 'pessimistic_read' },
          });
        if (roomType === null || roomType.hotelId !== staff.hotelId) {
          throw new ForbiddenException(
            'Bạn không được xử lý booking của khách sạn khác',
          );
        }
        if (booking.status !== BookingStatus.PENDING) {
          throw new ConflictException('Chỉ được xử lý booking đang PENDING');
        }

        booking.status = status;
        if (status === BookingStatus.CANCEL) {
          // Khách sạn từ chối yêu cầu chờ duyệt nên không thu phí hủy của khách.
          booking.cancelledAt = new Date();
          booking.cancellationFee = 0;
        }
        await repository.save(booking);
      },
    );

    return 'Cập nhật trạng thái booking thành công';
  }

  async cancelMyBooking(bookingId: string): Promise<BookingResponeDto> {
    const currentUser: AuthenticatedUser =
      this.authenticationContext.requireUser();

    return this.bookingsRepository.manager.transaction(
      'READ COMMITTED',
      async (manager: EntityManager): Promise<BookingResponeDto> => {
        const repository: Repository<Booking> = manager.getRepository(Booking);
        // Khóa cùng bản ghi với luồng staff duyệt để tính phí theo trạng thái mới nhất.
        const booking: Booking | null = await repository.findOne({
          where: { id: bookingId },
          lock: { mode: 'pessimistic_write' },
        });
        if (booking === null) {
          throw new NotFoundException('Không tìm thấy booking');
        }
        if (booking.userId !== currentUser.id) {
          throw new ForbiddenException(
            'Bạn chỉ được hủy booking của chính mình',
          );
        }
        if (
          booking.status !== BookingStatus.PENDING &&
          booking.status !== BookingStatus.ACCEPT
        ) {
          throw new ConflictException(
            'Chỉ được hủy booking đang PENDING hoặc ACCEPT',
          );
        }

        let cancellationFee: number = 0;
        if (booking.status === BookingStatus.ACCEPT) {
          // Tiền lưu dạng số nguyên nên làm tròn phí đến đơn vị tiền gần nhất.
          cancellationFee = Math.round(
            (booking.totalPrice * this.acceptedCancellationFeePercent) / 100,
          );
        }

        booking.status = BookingStatus.CANCEL;
        booking.cancellationFee = cancellationFee;
        booking.cancelledAt = new Date();
        const savedBooking: Booking = await repository.save(booking);

        const response: BookingResponeDto = new BookingResponeDto();
        response.id = savedBooking.id;
        response.userId = savedBooking.userId;
        response.roomId = savedBooking.roomId;
        response.guestCount = savedBooking.guestCount;
        response.startTime = savedBooking.startTime;
        response.endTime = savedBooking.endTime;
        response.totalPrice = savedBooking.totalPrice;
        response.status = savedBooking.status;
        response.cancellationFee = savedBooking.cancellationFee;
        response.createdAt = savedBooking.createdAt;
        response.cancelledAt = savedBooking.cancelledAt;
        return response;
      },
    );
  }

  async getMyBooking(): Promise<BookingResponeDto[]> {
    // 1. Lấy người đăng nhập, không nhận userId từ frontend.
    const currentUser: AuthenticatedUser =
      this.authenticationContext.requireUser();

    // 2. Chỉ truy vấn booking của người đăng nhập, mới nhất trước.
    const bookings: Booking[] = await this.bookingsRepository.find({
      where: { userId: currentUser.id },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    if (bookings.length === 0) {
      throw new NotFoundException('Bạn chưa có booking nào');
    }

    // 3. Duyệt từng booking và map sang các field được phép trong DTO.
    const responses: BookingResponeDto[] = [];

    for (const booking of bookings) {
      const response: BookingResponeDto = plainToInstance(
        BookingResponeDto,
        booking,
        { excludeExtraneousValues: true },
      );

      responses.push(response);
    }

    return responses;
  }

  private async checkBookingOverlap(
    repository: Repository<Booking>,
    roomId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    // Hai khoảng liền kề được phép; PENDING và ACCEPT đang giữ phòng.
    const overlaps: boolean = await repository.exists({
      where: {
        roomId: roomId,
        status: In([BookingStatus.PENDING, BookingStatus.ACCEPT]),
        startTime: LessThan(endTime),
        endTime: MoreThan(startTime),
      },
    });
    if (overlaps) {
      throw new ConflictException(
        'Phòng đã được đặt trong khoảng thời gian này',
      );
    }
  }
}
