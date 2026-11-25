import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Room } from '../../rooms/entities/room.entity';
import { User } from '../../users/entities/user.entity';

@Entity('bookings')
@Check('CHK_bookings_guest_count', '"guestCount" > 0')
@Check('CHK_bookings_time_range', '"endTime" > "startTime"')
@Check('CHK_bookings_total_price', '"totalPrice" >= 0')
@Check('CHK_bookings_cancellation_fee', '"cancellationFee" >= 0')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  userId!: string;

  @Column({ type: 'uuid', nullable: false })
  roomId!: string;

  @Column({ type: 'integer', nullable: false })
  guestCount!: number;

  @Column({ type: 'timestamptz', nullable: false })
  startTime!: Date;

  @Column({ type: 'timestamptz', nullable: false })
  endTime!: Date;

  @Column({ type: 'integer', nullable: false })
  totalPrice!: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  @Column({ type: 'integer', nullable: false, default: 0 })
  cancellationFee!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @ManyToOne(() => User, (user: User) => user.bookings, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Room, (room: Room) => room.bookings, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'roomId' })
  room!: Room;
}
