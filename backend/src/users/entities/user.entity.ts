import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { Hotel } from '../../hotels/entities/hotel.entity';
import { Review } from '../../reviews/entities/review.entity';

@Entity('users')
@Check(
  'CHK_users_role_hotel_id',
  `("role" IN ('${Role.STAFF}', '${Role.MANAGER}') AND "hotelId" IS NOT NULL) OR ("role" IN ('${Role.CUSTOMER}', '${Role.ADMIN}') AND "hotelId" IS NULL)`,
)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 100 })
  fullName!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  phone!: string | null;

  @Column({ type: 'enum', enum: Role, default: Role.CUSTOMER })
  role!: Role;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ type: 'uuid', nullable: true })
  hotelId!: string | null;

  @ManyToOne(() => Hotel, (hotel: Hotel) => hotel.staffs, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'hotelId' })
  hotel!: Hotel | null;

  @OneToMany(() => Review, (review: Review) => review.user)
  reviews!: Review[];

  @OneToMany(() => Booking, (booking: Booking) => booking.user)
  bookings!: Booking[];
}
