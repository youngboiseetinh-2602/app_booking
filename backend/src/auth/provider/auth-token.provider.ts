import { Injectable } from '@nestjs/common';
import { TokenService } from '@nestjs/authentication';
import type { User } from '../../users/entities/user.entity';
import type { LoginResponse } from '../interfaces/login-response.interface';

@Injectable()
export class AuthTokenProvider {
  constructor(private readonly tokenService: TokenService) {}

  async issue(user: Pick<User, 'id' | 'role'>): Promise<LoginResponse> {
    const { accessToken, expiresIn } = await this.tokenService.issue(user.id, {
      method: 'password',
      claims: { role: user.role },
    });
    return { accessToken, expiresIn, tokenType: 'Bearer' };
  }
}
