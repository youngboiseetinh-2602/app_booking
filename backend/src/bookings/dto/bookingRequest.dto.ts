import {
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { IsNotBlank } from '../../common/validators/is-not-blank.decorator';

export class BookingRequestDto {
  @IsNotBlank({ groups: ['required'], message: 'Phòng không được để trống' })
  @IsString({ groups: ['type'], message: 'Mã phòng phải là chuỗi' })
  @IsUUID('all', {
    groups: ['format'],
    message: 'Mã phòng phải là UUID hợp lệ',
  })
  roomId!: string;

  @IsNotBlank({ groups: ['required'], message: 'Số khách không được để trống' })
  @IsInt({ groups: ['type'], message: 'Số khách phải là số nguyên' })
  @Min(1, { groups: ['length'], message: 'Số khách phải lớn hơn 0' })
  guestCount!: number;

  @IsNotBlank({
    groups: ['required'],
    message: 'Thời gian bắt đầu không được để trống',
  })
  @IsString({ groups: ['type'], message: 'Thời gian bắt đầu phải là chuỗi' })
  @IsISO8601(
    { strict: true, strictSeparator: true },
    {
      groups: ['format'],
      message: 'Thời gian bắt đầu phải đúng định dạng ISO 8601',
    },
  )
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    groups: ['format'],
    message: 'Thời gian bắt đầu phải có múi giờ Z hoặc ±HH:mm',
  })
  startTime!: string;

  @IsNotBlank({
    groups: ['required'],
    message: 'Thời gian kết thúc không được để trống',
  })
  @IsString({ groups: ['type'], message: 'Thời gian kết thúc phải là chuỗi' })
  @IsISO8601(
    { strict: true, strictSeparator: true },
    {
      groups: ['format'],
      message: 'Thời gian kết thúc phải đúng định dạng ISO 8601',
    },
  )
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    groups: ['format'],
    message: 'Thời gian kết thúc phải có múi giờ Z hoặc ±HH:mm',
  })
  endTime!: string;
}
