import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Hotel } from '../../hotels/entities/hotel.entity';
import { User } from '../../users/entities/user.entity';

@Entity('reviews')
@Check('CHK_reviews_star_rate', '"starRate" BETWEEN 1 AND 5')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  userId!: string;

  @Column({ type: 'uuid', nullable: false })
  hotelId!: string;

  @Column({ type: 'text', nullable: false })
  comment!: string;

  @Column({ type: 'smallint', nullable: false })
  starRate!: number;

  @ManyToOne(() => User, (user: User) => user.reviews, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Hotel, (hotel: Hotel) => hotel.reviews, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'hotelId' })
  hotel!: Hotel;
}
