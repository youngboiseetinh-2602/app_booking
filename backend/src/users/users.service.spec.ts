import { jest } from '@jest/globals';
import { AuthenticationContext, PasswordHasher } from '@nestjs/authentication';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  FindManyOptions,
  FindOneOptions,
  QueryFailedError,
  Repository,
} from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { RegisterDto } from './dto/register.dto';
import { UserResponeDto } from './dto/userRespone.dto';
import type { User } from './entities/user.entity';
import type { UsersService } from './users.service';
import type { Hotel } from '../hotels/entities/hotel.entity';

jest.unstable_mockModule('../hotels/entities/hotel.entity', () => ({
  Hotel: class Hotel {},
}));

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
    findOne: (options: FindOneOptions<User>) => Promise<User | null>;
    update: Repository<User>['update'];
  }>;
  let service: UsersService;
  let hotelsRepository: jest.Mocked<{
    existsBy: Repository<Hotel>['existsBy'];
  }>;
  let Service: typeof import('./users.service').UsersService;
  const passwordHasher: PasswordHasher = new PasswordHasher({ logN: 10 });
  const context: AuthenticationContext<AuthenticatedUser> =
    new AuthenticationContext<AuthenticatedUser>();

  beforeAll(async (): Promise<void> => {
    Service = (await import('./users.service.js')).UsersService;
  });

  beforeEach((): void => {
    hotelsRepository = {
      existsBy: jest
        .fn<Repository<Hotel>['existsBy']>()
        .mockResolvedValue(true),
    };
    repository = {
      exists: jest.fn<Repository<User>['exists']>().mockResolvedValue(false),
      findOne: jest.fn<Repository<User>['findOne']>().mockResolvedValue(null),
      update: jest
        .fn<Repository<User>['update']>()
        .mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] }),
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
      context,
      hotelsRepository as unknown as Repository<Hotel>,
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

  describe('createStaff', (): void => {
    const manager: AuthenticatedUser = {
      id: '8c1de0c4-d314-419b-9610-df2ba1677ae0',
      username: 'manager',
      role: Role.MANAGER,
      hotelId: '19b2d2b7-fb63-4b05-a290-25af17a76529',
    };

    it('creates active staff in the manager hotel and returns no credentials', async (): Promise<void> => {
      const response: string = await context.run(
        { user: manager },
        (): Promise<string> => service.createStaff(dto),
      );
      const saved: User = repository.save.mock.calls[0][0];
      expect(saved.role).toBe(Role.STAFF);
      expect(saved.status).toBe(UserStatus.ACTIVE);
      expect(saved.hotelId).toBe(manager.hotelId);
      expect(saved.phone).toBeNull();
      await expect(
        passwordHasher.verify(dto.password, saved.passwordHash),
      ).resolves.toBe(true);
      expect(response).toBe('Thêm staff thành công');
    });

    it.each([Role.ADMIN, Role.CUSTOMER, Role.STAFF])(
      'rejects %s before querying or saving',
      async (role: Role): Promise<void> => {
        const principal: AuthenticatedUser = { ...manager, role };
        await expect(
          context.run({ user: principal }, (): Promise<string> =>
            service.createStaff(dto),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(repository.exists).not.toHaveBeenCalled();
        expect(repository.save).not.toHaveBeenCalled();
      },
    );

    it('requires authentication', async (): Promise<void> => {
      await expect(service.createStaff(dto)).rejects.toThrow();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects managers without an assigned hotel', async (): Promise<void> => {
      const principal: AuthenticatedUser = { ...manager, hotelId: null };
      await expect(
        context.run({ user: principal }, (): Promise<string> =>
          service.createStaff(dto),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects duplicate staff credentials', async (): Promise<void> => {
      repository.exists.mockResolvedValue(true);
      await expect(
        context.run({ user: manager }, (): Promise<string> =>
          service.createStaff(dto),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('handles concurrent duplicate insertions as conflict', async (): Promise<void> => {
      const driverError: Error & { code: string } = Object.assign(
        new Error('duplicate'),
        { code: '23505' },
      );
      repository.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], driverError),
      );
      await expect(
        context.run({ user: manager }, (): Promise<string> =>
          service.createStaff(dto),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('propagates unexpected persistence failures', async (): Promise<void> => {
      const error: Error = new Error('database unavailable');
      repository.save.mockRejectedValue(error);
      await expect(
        context.run({ user: manager }, (): Promise<string> =>
          service.createStaff(dto),
        ),
      ).rejects.toBe(error);
    });
  });

  describe('createManager', (): void => {
    const admin: AuthenticatedUser = {
      id: '8c1de0c4-d314-419b-9610-df2ba1677ae0',
      username: 'admin',
      role: Role.ADMIN,
      hotelId: null,
    };
    const hotelId: string = '19b2d2b7-fb63-4b05-a290-25af17a76529';

    it('creates a manager with a hashed password in the selected hotel', async (): Promise<void> => {
      await expect(
        context.run({ user: admin }, (): Promise<string> =>
          service.createManager(dto, hotelId),
        ),
      ).resolves.toBe('Thêm manager thành công');
      const saved: User = repository.save.mock.calls[0][0];
      expect(saved.role).toBe(Role.MANAGER);
      expect(saved.status).toBe(UserStatus.ACTIVE);
      expect(saved.hotelId).toBe(hotelId);
      expect(saved.phone).toBeNull();
      await expect(
        passwordHasher.verify(dto.password, saved.passwordHash),
      ).resolves.toBe(true);
    });

    it.each([Role.MANAGER, Role.STAFF, Role.CUSTOMER])(
      'denies %s before database access',
      async (role: Role): Promise<void> => {
        const principal: AuthenticatedUser = { ...admin, role };
        await expect(
          context.run({ user: principal }, (): Promise<string> =>
            service.createManager(dto, hotelId),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(hotelsRepository.existsBy).not.toHaveBeenCalled();
        expect(repository.save).not.toHaveBeenCalled();
      },
    );

    it('requires authentication', async (): Promise<void> => {
      await expect(service.createManager(dto, hotelId)).rejects.toThrow();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a missing hotel', async (): Promise<void> => {
      hotelsRepository.existsBy.mockResolvedValue(false);
      await expect(
        context.run({ user: admin }, (): Promise<string> =>
          service.createManager(dto, hotelId),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects duplicate credentials before saving', async (): Promise<void> => {
      repository.exists.mockResolvedValue(true);
      await expect(
        context.run({ user: admin }, (): Promise<string> =>
          service.createManager(dto, hotelId),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it.each([
      ['23505', ConflictException],
      ['23503', NotFoundException],
    ])(
      'handles persistence constraint %s',
      async (code, exception): Promise<void> => {
        const driverError: Error & { code: string } = Object.assign(
          new Error('constraint violation'),
          { code },
        );
        repository.save.mockRejectedValue(
          new QueryFailedError('INSERT', [], driverError),
        );
        await expect(
          context.run({ user: admin }, (): Promise<string> =>
            service.createManager(dto, hotelId),
          ),
        ).rejects.toBeInstanceOf(exception);
      },
    );
  });

  describe('getProfile using AuthenticationContext', (): void => {
    const principal: AuthenticatedUser = {
      id: '8c1de0c4-d314-419b-9610-df2ba1677ae0',
      username: 'customer',
      role: Role.CUSTOMER,
      hotelId: null,
    };
    const user: User = {
      ...principal,
      fullName: 'Khách hàng',
      email: 'customer@example.com',
      phone: null,
      status: UserStatus.ACTIVE,
      passwordHash: 'must-not-be-returned',
    } as User;

    it('requires a current authenticated user before querying persistence', async (): Promise<void> => {
      await expect(service.getProfile()).rejects.toThrow();
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('uses only the context ID and excludes sensitive fields', async (): Promise<void> => {
      repository.findOne.mockResolvedValue(user);
      const profile = await context.run(
        { user: principal },
        (): Promise<UserResponeDto> => service.getProfile(),
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: principal.id },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          hotelId: true,
        },
      });
      expect(profile).toMatchObject({
        id: principal.id,
        email: user.email,
        phone: null,
      });
      expect(profile).toBeInstanceOf(UserResponeDto);
      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).not.toHaveProperty('password');
    });

    it.each([null, { ...user, status: UserStatus.INACTIVE }])(
      'rejects a missing or inactive account',
      async (record: User | null): Promise<void> => {
        repository.findOne.mockResolvedValue(record);
        await expect(
          context.run({ user: principal }, (): Promise<UserResponeDto> =>
            service.getProfile(),
          ),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      },
    );

    it('updates only supplied fields of the active context user', async (): Promise<void> => {
      repository.findOne.mockResolvedValue({ ...user, fullName: 'Tên mới' });
      const profile: UserResponeDto = await context.run(
        { user: principal },
        (): Promise<UserResponeDto> =>
          service.updateProfile({ fullName: 'Tên mới' }),
      );
      expect(repository.update).toHaveBeenCalledWith(
        { id: principal.id, status: UserStatus.ACTIVE },
        { fullName: 'Tên mới' },
      );
      expect(profile).toBeInstanceOf(UserResponeDto);
      expect(profile.fullName).toBe('Tên mới');
      expect(profile.email).toBe(user.email);
      expect(profile).not.toHaveProperty('passwordHash');
    });

    it('can clear phone with null without changing other fields', async (): Promise<void> => {
      repository.findOne.mockResolvedValue(user);
      await context.run({ user: principal }, (): Promise<UserResponeDto> =>
        service.updateProfile({ phone: null }),
      );
      expect(repository.update).toHaveBeenCalledWith(
        { id: principal.id, status: UserStatus.ACTIVE },
        { phone: null },
      );
    });

    it('rejects an empty update before writing to persistence', async (): Promise<void> => {
      await expect(
        context.run({ user: principal }, (): Promise<UserResponeDto> =>
          service.updateProfile({}),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('requires authentication before updating', async (): Promise<void> => {
      await expect(
        service.updateProfile({ fullName: 'Tên mới' }),
      ).rejects.toThrow();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects accounts deactivated or deleted before the update', async (): Promise<void> => {
      repository.update.mockResolvedValue({
        affected: 0,
        raw: [],
        generatedMaps: [],
      });
      await expect(
        context.run({ user: principal }, (): Promise<UserResponeDto> =>
          service.updateProfile({ fullName: 'Tên mới' }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('turns duplicate email violations into HTTP 409', async (): Promise<void> => {
      const error: Error & { code: string } = Object.assign(
        new Error('duplicate'),
        { code: '23505' },
      );
      repository.update.mockRejectedValue(
        new QueryFailedError('UPDATE', [], error),
      );
      await expect(
        context.run({ user: principal }, (): Promise<UserResponeDto> =>
          service.updateProfile({ email: 'taken@example.com' }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('propagates unexpected update failures', async (): Promise<void> => {
      const error: Error = new Error('Database unavailable');
      repository.update.mockRejectedValue(error);
      await expect(
        context.run({ user: principal }, (): Promise<UserResponeDto> =>
          service.updateProfile({ fullName: 'Tên mới' }),
        ),
      ).rejects.toBe(error);
    });

    it('isolates users across concurrent asynchronous requests', async (): Promise<void> => {
      const other: AuthenticatedUser = {
        ...principal,
        id: '19b2d2b7-fb63-4b05-a290-25af17a76529',
      };
      repository.findOne.mockImplementation(
        async (options: FindOneOptions<User>): Promise<User> => {
          await Promise.resolve();
          const where = options.where;
          if (!where || Array.isArray(where) || typeof where.id !== 'string')
            throw new Error('Expected a scoped user ID');
          return { ...user, id: where.id };
        },
      );
      const profiles = await Promise.all(
        [principal, other].map((identity: AuthenticatedUser) =>
          context.run({ user: identity }, async (): Promise<UserResponeDto> => {
            await Promise.resolve();
            return service.getProfile();
          }),
        ),
      );
      expect(profiles.map((profile) => profile.id)).toEqual([
        principal.id,
        other.id,
      ]);
    });
  });
});
