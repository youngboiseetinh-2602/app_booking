import {
  Check,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HotelStatus } from '../../common/enums/hotel-status.enum';
import { Review } from '../../reviews/entities/review.entity';
import { RoomType } from '../../room-types/entities/room-type.entity';
import { User } from '../../users/entities/user.entity';

@Entity('hotels')
@Check('CHK_hotels_free_cancellation_hours', '"freeCancellationHours" >= 0')
@Check(
  'CHK_hotels_cancellation_fee_percent',
  '"cancellationFeePercent" BETWEEN 0 AND 100',
)
export class Hotel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 255 })
  address!: string;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'varchar', length: 15 })
  phone!: string;

  @Column({ type: 'enum', enum: HotelStatus, default: HotelStatus.ACTIVE })
  status!: HotelStatus;

  @Column({ type: 'integer' })
  freeCancellationHours!: number;

  @Column({ type: 'smallint' })
  cancellationFeePercent!: number;

  @OneToMany(() => User, (user: User) => user.hotel)
  staffs!: User[];

  @OneToMany(() => Review, (review: Review) => review.hotel)
  reviews!: Review[];

  @OneToMany(() => RoomType, (roomType: RoomType) => roomType.hotel)
  roomTypes!: RoomType[];
}
