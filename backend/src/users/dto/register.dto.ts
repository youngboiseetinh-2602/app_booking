import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsNotBlank } from '../../common/validators/is-not-blank.decorator';

export class RegisterDto {
  @IsNotBlank({
    groups: ['required'],
    message: 'Tên đăng nhập không được để trống',
  })
  @IsString({ groups: ['type'], message: 'Tên đăng nhập phải là chuỗi' })
  @MinLength(3, {
    groups: ['length'],
    message: 'Tên đăng nhập phải có ít nhất 3 ký tự',
  })
  @MaxLength(50, {
    groups: ['length'],
    message: 'Tên đăng nhập không được vượt quá 50 ký tự',
  })
  username!: string;

  @IsNotBlank({ groups: ['required'], message: 'Mật khẩu không được để trống' })
  @IsString({ groups: ['type'], message: 'Mật khẩu phải là chuỗi' })
  @MinLength(8, {
    groups: ['length'],
    message: 'Mật khẩu phải có ít nhất 8 ký tự',
  })
  @MaxLength(128, {
    groups: ['length'],
    message: 'Mật khẩu không được vượt quá 128 ký tự',
  })
  password!: string;

  @IsNotBlank({ groups: ['required'], message: 'Họ tên không được để trống' })
  @IsString({ groups: ['type'], message: 'Họ tên phải là chuỗi' })
  @MaxLength(100, {
    groups: ['length'],
    message: 'Họ tên không được vượt quá 100 ký tự',
  })
  fullName!: string;

  @IsNotBlank({ groups: ['required'], message: 'Email không được để trống' })
  @IsString({ groups: ['type'], message: 'Email phải là chuỗi' })
  @MaxLength(255, {
    groups: ['length'],
    message: 'Email không được vượt quá 255 ký tự',
  })
  @IsEmail({}, { groups: ['format'], message: 'Email không đúng định dạng' })
  email!: string;

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
