import { Controller } from '@nestjs/common';
import { Public } from '@nestjs/authentication';

@Public()
@Controller('bookings')
export class BookingsController {}
