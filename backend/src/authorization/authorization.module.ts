import { Module } from '@nestjs/common';
import { AuthorizationModule as NestAuthorizationModule } from '@nestjs/authorization';

@Module({
  imports: [NestAuthorizationModule.forRoot({ globalGuard: false })],
})
export class AuthorizationModule {}
