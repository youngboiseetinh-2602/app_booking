import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from './users.service';
import { OrderedValidationPipe } from '../common/pipes/ordered-validation.pipe';

@Public()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post('register')
  register(
    @Body(new OrderedValidationPipe())
    dto: RegisterDto,
  ): Promise<string> {
    return this.usersService.register(dto);
  }
}
