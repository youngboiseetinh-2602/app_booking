import { Controller } from '@nestjs/common';
import { Public } from '@nestjs/authentication';

@Public()
@Controller('reviews')
export class ReviewsController {}
