import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AuthenticationModule,
  type AuthenticationModuleOptions,
} from '@nestjs/authentication';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenProvider } from './provider/auth-token.provider';
import { JwtAuthProvider } from './provider/jwt-auth.provider';

@Module({
  imports: [
    UsersModule,
    AuthenticationModule.forRootAsync({
      globalGuard: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): AuthenticationModuleOptions => {
        const secret: string = config.getOrThrow<string>('JWT_SECRET');
        if (secret.length < 32)
          throw new Error('JWT_SECRET must contain at least 32 characters.');
        return {
          accessToken: {
            key: secret,
            ttl: '30m',
            alg: 'HS256',
            issuer: 'hotel-booking-api',
            audience: 'hotel-booking-client',
          },
          refreshToken: false,
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenProvider, JwtAuthProvider],
})
export class AuthModule {}
