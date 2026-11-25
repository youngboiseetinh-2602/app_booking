import { jest } from '@jest/globals';
import { PasswordHasher } from '@nestjs/authentication';
import { ConflictException } from '@nestjs/common';
import { FindManyOptions, QueryFailedError, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { RegisterDto } from './dto/register.dto';
import type { User } from './entities/user.entity';
import type { UsersService } from './users.service';

jest.unstable_mockModule('./entities/user.entity', () => ({
  User: class User {},
}));

describe('UsersService.register', (): void => {
  const dto: RegisterDto = {
    username: 'testcustomer',
    password: 'test-password-123',
    fullName: 'Khách hàng thử nghiệm',
    email: 'customer@example.com',
  };
  let repository: jest.Mocked<{
    exists: (options: FindManyOptions<User>) => Promise<boolean>;
    create: (data: Partial<User>) => User;
    save: (user: User) => Promise<User>;
  }>;
  let service: UsersService;
  let Service: typeof import('./users.service').UsersService;
  const passwordHasher: PasswordHasher = new PasswordHasher({ logN: 10 });

  beforeAll(async (): Promise<void> => {
    Service = (await import('./users.service.js')).UsersService;
  });

  beforeEach((): void => {
    repository = {
      exists: jest.fn<Repository<User>['exists']>().mockResolvedValue(false),
      create: jest.fn((data: Partial<User>): User => data as User),
      save: jest
        .fn<(user: User) => Promise<User>>()
        .mockImplementation((user: User): Promise<User> =>
          Promise.resolve(user),
        ),
    };
    service = new Service(
      repository as unknown as Repository<User>,
      passwordHasher,
    );
  });

  it('saves a verifiable password hash and a customer without raw password', async (): Promise<void> => {
    await expect(service.register(dto)).resolves.toBe('đăng kí thành công');
    const user: User = jest.mocked(repository.save).mock.calls[0][0];
    expect(user).toMatchObject({
      username: dto.username,
      fullName: dto.fullName,
      email: dto.email,
      phone: null,
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
      hotelId: null,
    });
    expect(user).not.toHaveProperty('password');
    expect(user.passwordHash).toMatch(/^\$scrypt\$ln=10,r=8,p=1\$/);
    expect(user.passwordHash.length).toBeLessThanOrEqual(255);
    await expect(
      passwordHasher.verify(dto.password, user.passwordHash),
    ).resolves.toBe(true);
    await expect(
      passwordHasher.verify('wrong-password', user.passwordHash),
    ).resolves.toBe(false);
  });

  it('uses a different salt for each registration', async (): Promise<void> => {
    await service.register(dto);
    await service.register({
      ...dto,
      username: 'secondcustomer',
      email: 'second@example.com',
    });
    const calls = jest.mocked(repository.save).mock.calls;
    const first: User = calls[0][0];
    const second: User = calls[1][0];
    expect(first.passwordHash).not.toBe(second.passwordHash);
  });

  it('rejects duplicate username or email before saving', async (): Promise<void> => {
    jest.mocked(repository.exists).mockResolvedValue(true);
    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.exists).toHaveBeenCalledWith({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns conflict for a concurrent unique constraint violation', async (): Promise<void> => {
    const driverError: Error & { code: string } = Object.assign(
      new Error('duplicate'),
      { code: '23505' },
    );
    jest
      .mocked(repository.save)
      .mockRejectedValue(new QueryFailedError('INSERT', [], driverError));
    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('propagates other database failures', async (): Promise<void> => {
    const error: Error = new Error('database unavailable');
    jest.mocked(repository.save).mockRejectedValue(error);
    await expect(service.register(dto)).rejects.toBe(error);
  });
});
