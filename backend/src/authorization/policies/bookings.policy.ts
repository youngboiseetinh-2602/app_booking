import { Policy } from '@nestjs/authorization';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Role } from '../../common/enums/role.enum';

@Policy()
export class BookingsPolicy {
  updateStatus(user: AuthenticatedUser | null): boolean {
    if (user === null) {
      return false;
    }

    return user.role === Role.STAFF && user.hotelId !== null;
  }

  createBooking(user: AuthenticatedUser | null): boolean {
    if (user === null) {
      return false;
    }

    return user.role === Role.CUSTOMER;
  }
}
