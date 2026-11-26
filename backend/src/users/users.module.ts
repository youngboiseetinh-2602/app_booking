import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersPolicy } from '../authorization/policies/users.policy';
import { Hotel } from '../hotels/entities/hotel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Hotel])],
  controllers: [UsersController],
  providers: [UsersService, UsersPolicy],
  exports: [UsersService, UsersPolicy],
})
export class UsersModule {}
