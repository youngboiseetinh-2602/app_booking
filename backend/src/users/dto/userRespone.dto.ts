import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

export class UserResponeDto {
  id!: string;
  username!: string;
  fullName!: string;
  email!: string;
  phone!: string | null;
  role!: Role;
  status!: UserStatus;
  hotelId!: string | null;
}
