import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Authenticate } from '@nestjs/authentication';
import { AuthorizationGuard, Can } from '@nestjs/authorization';
import { UsersPolicy } from '../authorization/policies/users.policy';
import { OrderedValidationPipe } from '../common/pipes/ordered-validation.pipe';
import { RegisterDto } from '../users/dto/register.dto';
import { UsersService } from '../users/users.service';

@Controller('hotels')
export class HotelsController {
  constructor(private readonly usersService: UsersService) {}

  @Authenticate()
  @UseGuards(AuthorizationGuard)
  @Can(UsersPolicy, 'createManager')
  @Post(':hotelId/managers')
  createManager(
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Body(new OrderedValidationPipe()) dto: RegisterDto,
  ): Promise<string> {
    return this.usersService.createManager(dto, hotelId);
  }
}
