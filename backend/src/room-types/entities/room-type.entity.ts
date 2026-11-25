import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Hotel } from '../../hotels/entities/hotel.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('room_types')
@Check('CHK_room_types_capacity', '"capacity" > 0')
@Check('CHK_room_types_price_per_hour', '"pricePerHour" >= 0')
export class RoomType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  hotelId!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'integer', nullable: false })
  capacity!: number;

  @Column({ type: 'integer', nullable: false })
  pricePerHour!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => Hotel, (hotel: Hotel) => hotel.roomTypes, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'hotelId' })
  hotel!: Hotel;

  @OneToMany(() => Room, (room: Room) => room.roomType)
  rooms!: Room[];
}
