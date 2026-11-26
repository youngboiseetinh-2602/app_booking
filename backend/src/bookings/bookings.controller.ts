import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Authenticate } from '@nestjs/authentication';
import { AuthorizationGuard, Can } from '@nestjs/authorization';
import { BookingsService } from './bookings.service';
import type { BookingResponeDto } from './dto/bookingRespone.dto';
import { BookingRequestDto } from './dto/bookingRequest.dto';
import { OrderedValidationPipe } from '../common/pipes/ordered-validation.pipe';
import { BookingsPolicy } from '../authorization/policies/bookings.policy';
import { BookingStatus } from '../common/enums/booking-status.enum';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Authenticate()
  @UseGuards(AuthorizationGuard)
  @Can(BookingsPolicy, 'updateStatus')
  @Patch(':id/status')
  updateBookingStatus(
    @Param('id', new ParseUUIDPipe()) bookingId: string,
    @Body('status', new ParseEnumPipe(BookingStatus)) status: BookingStatus,
  ): Promise<string> {
    return this.bookingsService.updateBookingStatus(bookingId, status);
  }

  @Authenticate()
  @UseGuards(AuthorizationGuard)
  @Can(BookingsPolicy, 'createBooking')
  @Post()
  createBooking(
    @Body(new OrderedValidationPipe()) dto: BookingRequestDto,
  ): Promise<string> {
    return this.bookingsService.createBooking(dto);
  }

  @Authenticate()
  @Get('me')
  getMyBooking(): Promise<BookingResponeDto[]> {
    return this.bookingsService.getMyBooking();
  }

  @Authenticate()
  @Patch(':id/cancel')
  cancelMyBooking(
    @Param('id', new ParseUUIDPipe()) bookingId: string,
  ): Promise<BookingResponeDto> {
    return this.bookingsService.cancelMyBooking(bookingId);
  }
}
