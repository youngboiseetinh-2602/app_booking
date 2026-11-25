import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { RoomStatus } from '../../common/enums/room-status.enum';
import { RoomType } from '../../room-types/entities/room-type.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  roomTypeId!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  name!: string;

  @Column({ type: 'enum', enum: RoomStatus, default: RoomStatus.ACTIVE })
  status!: RoomStatus;

  @ManyToOne(() => RoomType, (roomType: RoomType) => roomType.rooms, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'roomTypeId' })
  roomType!: RoomType;

  @OneToMany(() => Booking, (booking: Booking) => booking.room)
  bookings!: Booking[];
}
