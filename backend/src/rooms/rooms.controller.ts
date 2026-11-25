import { Controller } from '@nestjs/common';
import { Public } from '@nestjs/authentication';

@Public()
@Controller('rooms')
export class RoomsController {}
