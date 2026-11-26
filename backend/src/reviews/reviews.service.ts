import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Review } from './entities/review.entity';
import { ReviewResponeDto } from './dto/reviewRespone.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    private readonly authenticationContext: AuthenticationContext<AuthenticatedUser>,
  ) {}

  async getMyReview(): Promise<ReviewResponeDto[]> {
    // 1. Lấy người đăng nhập từ context.
    const currentUser: AuthenticatedUser =
      this.authenticationContext.requireUser();

    // 2. Chỉ lấy đánh giá của người đăng nhập.
    const reviews: Review[] = await this.reviewsRepository.find({
      where: { userId: currentUser.id },
      relations: { hotel: true, user: true },
      select: {
        id: true,
        hotelId: true,
        userId: true,
        comment: true,
        starRate: true,
        hotel: { name: true },
        user: { fullName: true },
      },
      order: { id: 'DESC' },
    });

    if (reviews.length === 0) {
      throw new NotFoundException('Bạn chưa có đánh giá nào');
    }

    // 3. Map comment, số sao và lấy tên từ hai Relation đã truy vấn.
    const responses: ReviewResponeDto[] = [];

    for (const review of reviews) {
      const response: ReviewResponeDto = plainToInstance(
        ReviewResponeDto,
        review,
        {
          excludeExtraneousValues: true,
        },
      );
      response.hotelName = review.hotel.name;
      response.reviewerName = review.user.fullName;
      responses.push(response);
    }

    return responses;
  }
}
