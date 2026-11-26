import { jest } from '@jest/globals';
import { AuthenticationContext } from '@nestjs/authentication';
import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../common/enums/role.enum';
import { OrderedValidationPipe } from '../common/pipes/ordered-validation.pipe';
import { ReviewResponeDto } from './dto/reviewRespone.dto';
import { ReviewRequestDto } from './dto/reviewRequest.dto';
import type { Review } from './entities/review.entity';
import type { ReviewsService } from './reviews.service';

jest.unstable_mockModule('./entities/review.entity', () => ({
  Review: class Review {},
}));

describe('ReviewsService.getMyReview', (): void => {
  let service: ReviewsService;
  let Service: typeof import('./reviews.service').ReviewsService;
  let ReviewEntity: typeof import('./entities/review.entity').Review;
  const find = jest.fn<Repository<Review>['find']>();
  const context: AuthenticationContext<AuthenticatedUser> =
    new AuthenticationContext<AuthenticatedUser>();
  const currentUser: AuthenticatedUser = {
    id: '8c1de0c4-d314-419b-9610-df2ba1677ae0',
    username: 'customer',
    role: Role.CUSTOMER,
    hotelId: null,
  };

  beforeAll(async (): Promise<void> => {
    Service = (await import('./reviews.service.js')).ReviewsService;
    ReviewEntity = (await import('./entities/review.entity.js')).Review;
  });

  beforeEach((): void => {
    find.mockReset();
    find.mockResolvedValue([]);
    service = new Service({ find } as unknown as Repository<Review>, context);
  });

  it('requires an authenticated user before querying', async (): Promise<void> => {
    await expect(service.getMyReview()).rejects.toThrow();
    expect(find).not.toHaveBeenCalled();
  });

  it('returns 404 if the current user has no reviews', async (): Promise<void> => {
    await expect(
      context.run({ user: currentUser }, (): Promise<ReviewResponeDto[]> =>
        service.getMyReview(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: currentUser.id },
        relations: { hotel: true, user: true },
        order: { id: 'DESC' },
      }),
    );
  });

  it('returns hotel name, reviewer full name, comment and stars without identifiers or sensitive data', async (): Promise<void> => {
    const review: Review = new ReviewEntity();
    review.id = '19b2d2b7-fb63-4b05-a290-25af17a76529';
    review.userId = currentUser.id;
    review.hotelId = '27ab2c50-c5c6-42cf-928a-140143c0d8f2';
    review.comment = 'Phòng sạch, nhân viên thân thiện';
    review.starRate = 5;
    Reflect.set(review, 'user', {
      fullName: 'Nguyễn Hữu Duy',
      passwordHash: 'private',
    });
    Reflect.set(review, 'hotel', {
      id: review.hotelId,
      name: 'The Aurora Hotel',
    });
    find.mockResolvedValue([review]);

    const responses: ReviewResponeDto[] = await context.run(
      { user: currentUser },
      (): Promise<ReviewResponeDto[]> => service.getMyReview(),
    );
    expect(responses).toHaveLength(1);
    expect(responses[0]).toBeInstanceOf(ReviewResponeDto);
    expect(responses[0]).toEqual({
      hotelName: 'The Aurora Hotel',
      reviewerName: 'Nguyễn Hữu Duy',
      comment: review.comment,
      starRate: review.starRate,
    });
  });

  it('propagates database failures', async (): Promise<void> => {
    const error: Error = new Error('Database unavailable');
    find.mockRejectedValue(error);
    await expect(
      context.run({ user: currentUser }, (): Promise<ReviewResponeDto[]> =>
        service.getMyReview(),
      ),
    ).rejects.toBe(error);
  });

  it('validates a request with only comment and starRate and rejects client supplied userId', async (): Promise<void> => {
    const pipe: OrderedValidationPipe = new OrderedValidationPipe();
    const valid: ReviewRequestDto = new ReviewRequestDto();
    valid.comment = 'Phòng sạch';
    valid.starRate = 5;
    await expect(
      pipe.transform(valid, { type: 'body', metatype: ReviewRequestDto }),
    ).resolves.toMatchObject(valid);

    valid.starRate = 6;
    await expect(
      pipe.transform(valid, { type: 'body', metatype: ReviewRequestDto }),
    ).rejects.toMatchObject({
      response: { message: 'Số sao phải từ 1 đến 5' },
    });
    valid.starRate = 5;
    Reflect.set(valid, 'userId', currentUser.id);
    await expect(
      pipe.transform(valid, { type: 'body', metatype: ReviewRequestDto }),
    ).rejects.toMatchObject({
      response: { message: 'property userId should not exist' },
    });
  });
});
