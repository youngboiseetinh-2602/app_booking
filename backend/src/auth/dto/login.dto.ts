import { IsString, MaxLength } from 'class-validator';
import { IsNotBlank } from '../../common/validators/is-not-blank.decorator';

export class LoginDto {
  @IsNotBlank({
    groups: ['required'],
    message: 'Tên đăng nhập không được để trống',
  })
  @IsString({ groups: ['type'], message: 'Tên đăng nhập phải là chuỗi' })
  @MaxLength(50, {
    groups: ['length'],
    message: 'Tên đăng nhập không được vượt quá 50 ký tự',
  })
  username!: string;

  @IsNotBlank({ groups: ['required'], message: 'Mật khẩu không được để trống' })
  @IsString({ groups: ['type'], message: 'Mật khẩu phải là chuỗi' })
  @MaxLength(128, {
    groups: ['length'],
    message: 'Mật khẩu không được vượt quá 128 ký tự',
  })
  password!: string;
}
