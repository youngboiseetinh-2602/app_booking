import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { UserStatus } from '../common/enums/user-status.enum';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthTokenProvider } from './provider/auth-token.provider';
import { LoginDto } from './dto/login.dto';
import type { LoginResponse } from './interfaces/login-response.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasher,
    private readonly authTokenProvider: AuthTokenProvider,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user: User | null =
      await this.usersService.findByUsernameWithPassword(dto.username);
    const valid: boolean = await this.passwordHasher.verify(
      dto.password,
      user?.passwordHash,
    );
    if (!user || user.status !== UserStatus.ACTIVE || !valid) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    return this.authTokenProvider.issue(user);
  }
}
