import { ConflictException, Injectable } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { RegisterDto } from './dto/register.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(dto: RegisterDto): Promise<string> {
    const exists: boolean = await this.usersRepository.exists({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    if (exists) {
      throw new ConflictException('Tên đăng nhập hoặc email đã tồn tại');
    }

    const passwordHash: string = await this.passwordHasher.hash(dto.password);
    const user: User = this.usersRepository.create({
      username: dto.username,
      passwordHash,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone ?? null,
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
      hotelId: null,
    });

    try {
      await this.usersRepository.save(user);
    } catch (error: unknown) {
      // The unique constraints also protect simultaneous registration requests.
      if (error instanceof QueryFailedError) {
        const driverError: unknown = error.driverError;
        if (
          typeof driverError === 'object' &&
          driverError !== null &&
          'code' in driverError &&
          driverError.code === '23505'
        ) {
          throw new ConflictException('Tên đăng nhập hoặc email đã tồn tại');
        }
      }
      throw error;
    }

    return 'đăng kí thành công';
  }

  findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { username },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        role: true,
        status: true,
      },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }
}
