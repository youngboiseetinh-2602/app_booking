import { Policy } from '@nestjs/authorization';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Role } from '../../common/enums/role.enum';

@Policy()
export class UsersPolicy {
  createManager(user: AuthenticatedUser | null): boolean {
    if (user === null) {
      return false;
    }

    return user.role === Role.ADMIN;
  }

  createStaff(user: AuthenticatedUser | null): boolean {
    if (user === null) {
      return false;
    }

    return user.role === Role.MANAGER && user.hotelId !== null;
  }
}
