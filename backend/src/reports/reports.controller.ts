import { Controller } from '@nestjs/common';
import { Public } from '@nestjs/authentication';

@Public()
@Controller('reports')
export class ReportsController {}
