import { Controller } from '@nestjs/common';
import { Public } from '@nestjs/authentication';

@Public()
@Controller('room-types')
export class RoomTypesController {}
