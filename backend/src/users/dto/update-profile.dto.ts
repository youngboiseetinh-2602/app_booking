import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsNotBlank } from '../../common/validators/is-not-blank.decorator';

export class UpdateProfileDto {
  @ValidateIf(
    (_object: unknown, value: unknown): boolean => value !== undefined,
    { always: true },
  )
  @IsNotBlank({ groups: ['required'], message: 'Họ tên không được để trống' })
  @IsString({ groups: ['type'], message: 'Họ tên phải là chuỗi' })
  @MaxLength(100, {
    groups: ['length'],
    message: 'Họ tên không được vượt quá 100 ký tự',
  })
  fullName?: string;

  @ValidateIf(
    (_object: unknown, value: unknown): boolean => value !== undefined,
    { always: true },
  )
  @IsNotBlank({ groups: ['required'], message: 'Email không được để trống' })
  @IsString({ groups: ['type'], message: 'Email phải là chuỗi' })
  @MaxLength(255, {
    groups: ['length'],
    message: 'Email không được vượt quá 255 ký tự',
  })
  @IsEmail({}, { groups: ['format'], message: 'Email không đúng định dạng' })
  email?: string;

  @IsOptional({ always: true })
  @IsNotBlank({
    groups: ['required'],
    message: 'Số điện thoại không được để trống',
  })
  @IsString({ groups: ['type'], message: 'Số điện thoại phải là chuỗi' })
  @MaxLength(15, {
    groups: ['length'],
    message: 'Số điện thoại không được vượt quá 15 ký tự',
  })
  phone?: string | null;
}
