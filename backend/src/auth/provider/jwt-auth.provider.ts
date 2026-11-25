import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import { isUUID } from 'class-validator';
import { UserStatus } from '../../common/enums/user-status.enum';
import type { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class JwtAuthProvider extends JwtBearerProvider<AuthenticatedUser> {
  constructor(
    private readonly usersService: UsersService,
    registry: AuthenticationRegistry,
  ) {
    super({ maxAge: '30m' });
    registry.registerProvider(this);
  }

  protected async validate(
    claims: JwtClaims,
  ): Promise<AuthenticatedUser | null> {
    if (typeof claims.sub !== 'string' || !isUUID(claims.sub)) return null;
    const user: User | null = await this.usersService.findById(claims.sub);
    if (!user || user.status !== UserStatus.ACTIVE) return null;
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      hotelId: user.hotelId,
    };
  }
}
