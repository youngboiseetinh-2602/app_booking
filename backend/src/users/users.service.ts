import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticationContext, PasswordHasher } from '@nestjs/authentication';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository, type UpdateResult } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { RegisterDto } from './dto/register.dto';
import { User } from './entities/user.entity';
import { UserResponeDto } from './dto/userRespone.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Hotel } from '../hotels/entities/hotel.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly passwordHasher: PasswordHasher,
    private readonly authenticationContext: AuthenticationContext<AuthenticatedUser>,
    @InjectRepository(Hotel)
    private readonly hotelsRepository: Repository<Hotel>,
  ) {}

  async register(dto: RegisterDto): Promise<string> {
    await this.createUser(dto, Role.CUSTOMER, null);

    return 'đăng kí thành công';
  }

  async createStaff(dto: RegisterDto): Promise<string> {
    const manager: AuthenticatedUser = this.authenticationContext.requireUser();

    if (manager.role !== Role.MANAGER) {
      throw new ForbiddenException('Chỉ manager mới được phép thêm staff');
    }

    if (manager.hotelId === null) {
      throw new ForbiddenException('Manager chưa được phân công khách sạn');
    }

    // Staff thuộc khách sạn của manager, không nhận quyền từ client.
    await this.createUser(dto, Role.STAFF, manager.hotelId);

    return 'Thêm staff thành công';
  }

  async createManager(dto: RegisterDto, hotelId: string): Promise<string> {
    const admin: AuthenticatedUser = this.authenticationContext.requireUser();

    if (admin.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ admin mới được phép thêm manager');
    }

    const hotelExists: boolean = await this.hotelsRepository.existsBy({
      id: hotelId,
    });
    if (!hotelExists) {
      throw new NotFoundException('Không tìm thấy khách sạn');
    }

    await this.createUser(dto, Role.MANAGER, hotelId);

    return 'Thêm manager thành công';
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async updateProfile(dto: UpdateProfileDto): Promise<UserResponeDto> {
    const currentUser: AuthenticatedUser =
      this.authenticationContext.requireUser();

    if (
      dto.fullName === undefined &&
      dto.email === undefined &&
      dto.phone === undefined
    ) {
      throw new BadRequestException(
        'Cần cung cấp ít nhất một thông tin cần cập nhật',
      );
    }

    // 3. Chỉ đưa các field được phép sửa vào dữ liệu cập nhật.
    // undefined: không gửi field; null: chủ động xóa số điện thoại.
    const updateData: UpdateProfileDto = {};

    if (dto.fullName !== undefined) {
      updateData.fullName = dto.fullName;
    }

    if (dto.email !== undefined) {
      updateData.email = dto.email;
    }

    if (dto.phone !== undefined) {
      updateData.phone = dto.phone;
    }

    // 4. Cập nhật đúng tài khoản hiện tại và chỉ khi còn ACTIVE.
    try {
      const updateResult: UpdateResult = await this.usersRepository.update(
        { id: currentUser.id, status: UserStatus.ACTIVE },
        updateData,
      );

      // affected là số dòng đã được cập nhật.
      if (updateResult.affected !== 1) {
        throw new UnauthorizedException(
          'Tài khoản không tồn tại hoặc không hoạt động',
        );
      }
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email đã tồn tại');
      }

      throw error;
    }

    // 5. Đọc lại hồ sơ để trả dữ liệu mới nhất.
    return this.getProfile();
  }

  async getProfile(): Promise<UserResponeDto> {
    const principal: AuthenticatedUser =
      this.authenticationContext.requireUser();
    const user: User | null = await this.usersRepository.findOne({
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
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc không hoạt động',
      );
    }
    // Map từng field sang DTO, không sao chép mật khẩu hoặc Relation.
    const response: UserResponeDto = new UserResponeDto();
    response.id = user.id;
    response.username = user.username;
    response.fullName = user.fullName;
    response.email = user.email;
    response.phone = user.phone;
    response.role = user.role;
    response.status = user.status;
    response.hotelId = user.hotelId;

    return response;
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

  private async createUser(
    dto: RegisterDto,
    role: Role,
    hotelId: string | null,
  ): Promise<void> {
    const exists: boolean = await this.usersRepository.exists({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    if (exists) {
      throw new ConflictException('Tên đăng nhập hoặc email đã tồn tại');
    }

    const passwordHash: string = await this.passwordHasher.hash(dto.password);
    const user: User = this.usersRepository.create({});
    user.username = dto.username;
    user.passwordHash = passwordHash;
    user.fullName = dto.fullName;
    user.email = dto.email;
    user.phone = null;
    if (dto.phone !== undefined) {
      user.phone = dto.phone;
    }
    user.role = role;
    user.status = UserStatus.ACTIVE;
    user.hotelId = hotelId;

    try {
      await this.usersRepository.save(user);
    } catch (error: unknown) {
      // Ràng buộc UNIQUE bảo vệ cả các request tạo tài khoản đồng thời.
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Tên đăng nhập hoặc email đã tồn tại');
      }
      // Khách sạn có thể bị xóa trước khi lưu tài khoản.
      if (hotelId !== null && error instanceof QueryFailedError) {
        const driverError: unknown = error.driverError;
        if (
          typeof driverError === 'object' &&
          driverError !== null &&
          'code' in driverError &&
          driverError.code === '23503'
        ) {
          // PostgreSQL dùng mã 23503 khi vi phạm khóa ngoại.
          throw new NotFoundException('Không tìm thấy khách sạn');
        }
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError: unknown = error.driverError;

    if (typeof driverError !== 'object' || driverError === null) {
      return false;
    }

    if (!('code' in driverError)) {
      return false;
    }

    // PostgreSQL dùng mã 23505 khi vi phạm UNIQUE, như trùng email.
    return driverError.code === '23505';
  }
}
