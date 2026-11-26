import { Controller, Get } from '@nestjs/common';
import { Authenticate, Public } from '@nestjs/authentication';
import { ReviewsService } from './reviews.service';
import type { ReviewResponeDto } from './dto/reviewRespone.dto';

@Public()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Authenticate()
  @Get('me')
  getMyReview(): Promise<ReviewResponeDto[]> {
    return this.reviewsService.getMyReview();
  }
}
