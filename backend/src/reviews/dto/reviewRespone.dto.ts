import { Expose } from 'class-transformer';

export class ReviewResponeDto {
  @Expose()
  hotelName!: string;

  @Expose()
  reviewerName!: string;

  @Expose()
  comment!: string;

  @Expose()
  starRate!: number;
}
