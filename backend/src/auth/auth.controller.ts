import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Authenticate, CurrentUser, Public } from '@nestjs/authentication';
import { LoginDto } from './dto/login.dto';
import { OrderedValidationPipe } from '../common/pipes/ordered-validation.pipe';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import type { LoginResponse } from './interfaces/login-response.interface';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new OrderedValidationPipe())
    dto: LoginDto,
  ): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Authenticate()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
