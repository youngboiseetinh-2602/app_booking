import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomType } from './entities/room-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RoomType])],
})
export class RoomTypesModule {}
