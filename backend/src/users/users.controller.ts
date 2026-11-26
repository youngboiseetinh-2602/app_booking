import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Authenticate, Public } from '@nestjs/authentication';
import { AuthorizationGuard, Can } from '@nestjs/authorization';
import { UsersPolicy } from '../authorization/policies/users.policy';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from './users.service';
import { OrderedValidationPipe } from '../common/pipes/ordered-validation.pipe';
import type { UserResponeDto } from './dto/userRespone.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Authenticate()
  @UseGuards(AuthorizationGuard)
  @Can(UsersPolicy, 'createStaff')
  @Post('staff')
  createStaff(
    @Body(new OrderedValidationPipe()) dto: RegisterDto,
  ): Promise<string> {
    return this.usersService.createStaff(dto);
  }

  @Authenticate()
  @Get('me')
  getProfile(): Promise<UserResponeDto> {
    return this.usersService.getProfile();
  }

  @Authenticate()
  @Patch('me')
  updateProfile(
    @Body(new OrderedValidationPipe()) dto: UpdateProfileDto,
  ): Promise<UserResponeDto> {
    return this.usersService.updateProfile(dto);
  }

  @Public()
  @Post('register')
  register(
    @Body(new OrderedValidationPipe())
    dto: RegisterDto,
  ): Promise<string> {
    return this.usersService.register(dto);
  }
}
