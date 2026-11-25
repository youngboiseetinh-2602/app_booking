import type { ArgumentMetadata } from '@nestjs/common';
import { LoginDto } from '../../auth/dto/login.dto';
import { RegisterDto } from '../../users/dto/register.dto';
import { OrderedValidationPipe } from './ordered-validation.pipe';

describe('OrderedValidationPipe', (): void => {
  const pipe: OrderedValidationPipe = new OrderedValidationPipe();
  const login: ArgumentMetadata = { type: 'body', metatype: LoginDto };
  const register: ArgumentMetadata = { type: 'body', metatype: RegisterDto };
  const valid: RegisterDto = {
    username: 'duy123',
    password: '12345678',
    fullName: 'Nguyễn Hữu Duy',
    email: 'duy@example.com',
  };

  it.each([undefined, null, '', '   '])(
    'reports only missing password for %p',
    async (password: unknown): Promise<void> => {
      await expect(
        pipe.transform({ username: 'duy123', password }, login),
      ).rejects.toMatchObject({
        response: { statusCode: 400, message: 'Mật khẩu không được để trống' },
      });
    },
  );

  it('checks missing values in all fields before length', async (): Promise<void> => {
    await expect(
      pipe.transform({ username: 'x'.repeat(51) }, login),
    ).rejects.toMatchObject({
      response: { message: 'Mật khẩu không được để trống' },
    });
  });

  it('checks missing values before types', async (): Promise<void> => {
    await expect(
      pipe.transform({ username: 123 }, login),
    ).rejects.toMatchObject({
      response: { message: 'Mật khẩu không được để trống' },
    });
  });

  it('checks types before length', async (): Promise<void> => {
    await expect(
      pipe.transform({ username: 'x'.repeat(51), password: 123 }, login),
    ).rejects.toMatchObject({
      response: { message: 'Mật khẩu phải là chuỗi' },
    });
  });

  it('checks length before email format', async (): Promise<void> => {
    await expect(
      pipe.transform({ ...valid, password: '123', email: 'invalid' }, register),
    ).rejects.toMatchObject({
      response: { message: 'Mật khẩu phải có ít nhất 8 ký tự' },
    });
  });

  it('checks required email before short username', async (): Promise<void> => {
    await expect(
      pipe.transform({ ...valid, username: 'ab', email: '' }, register),
    ).rejects.toMatchObject({
      response: { message: 'Email không được để trống' },
    });
  });

  it('reports only email format once preceding stages pass', async (): Promise<void> => {
    await expect(
      pipe.transform({ ...valid, email: 'invalid' }, register),
    ).rejects.toMatchObject({
      response: { message: 'Email không đúng định dạng' },
    });
  });

  it('rejects blank full names', async (): Promise<void> => {
    await expect(
      pipe.transform({ ...valid, fullName: '   ' }, register),
    ).rejects.toMatchObject({
      response: { message: 'Họ tên không được để trống' },
    });
  });

  it.each([undefined, null])(
    'keeps phone optional for %p',
    async (phone: unknown): Promise<void> => {
      await expect(
        pipe.transform({ ...valid, phone }, register),
      ).resolves.toMatchObject(valid);
    },
  );

  it('rejects a provided blank phone', async (): Promise<void> => {
    await expect(
      pipe.transform({ ...valid, phone: ' ' }, register),
    ).rejects.toMatchObject({
      response: { message: 'Số điện thoại không được để trống' },
    });
  });

  it('still rejects additional client privileges with one error', async (): Promise<void> => {
    await expect(
      pipe.transform({ ...valid, role: 'ADMIN' }, register),
    ).rejects.toMatchObject({
      response: { message: 'property role should not exist' },
    });
  });

  it('does not alter password whitespace', async (): Promise<void> => {
    await expect(
      pipe.transform({ ...valid, password: ' 12345678 ' }, register),
    ).resolves.toMatchObject({
      password: ' 12345678 ',
    });
  });
});
