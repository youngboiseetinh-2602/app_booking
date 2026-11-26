import { IsInt, IsString, Max, Min } from 'class-validator';
import { IsNotBlank } from '../../common/validators/is-not-blank.decorator';

export class ReviewRequestDto {
  @IsNotBlank({
    groups: ['required'],
    message: 'Nội dung đánh giá không được để trống',
  })
  @IsString({ groups: ['type'], message: 'Nội dung đánh giá phải là chuỗi' })
  comment!: string;

  @IsNotBlank({ groups: ['required'], message: 'Số sao không được để trống' })
  @IsInt({ groups: ['type'], message: 'Số sao phải là số nguyên' })
  @Min(1, { groups: ['length'], message: 'Số sao phải từ 1 đến 5' })
  @Max(5, { groups: ['length'], message: 'Số sao phải từ 1 đến 5' })
  starRate!: number;
}
