import { Role } from '../../common/enums/role.enum';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: Role;
  hotelId: string | null;
}

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AuthenticatedUser;
    refreshTokens: false;
  }
}
