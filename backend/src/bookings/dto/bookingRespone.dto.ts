import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Expose } from 'class-transformer';

export class BookingResponeDto {
  @Expose()
  id!: string;
  @Expose()
  userId!: string;
  @Expose()
  roomId!: string;
  @Expose()
  guestCount!: number;
  @Expose()
  startTime!: Date;
  @Expose()
  endTime!: Date;
  @Expose()
  totalPrice!: number;
  @Expose()
  status!: BookingStatus;
  @Expose()
  cancellationFee!: number;
  @Expose()
  createdAt!: Date;
  @Expose()
  cancelledAt!: Date | null;
}
