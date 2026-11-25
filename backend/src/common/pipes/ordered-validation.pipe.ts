import {
  BadRequestException,
  Injectable,
  ValidationPipe,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import type { ValidationError } from 'class-validator';

function firstMessage(errors: ValidationError[]): string | undefined {
  for (const error of errors) {
    const message: string | undefined = Object.values(
      error.constraints ?? {},
    )[0];
    if (message) return message;
    const childMessage: string | undefined = firstMessage(error.children ?? []);
    if (childMessage) return childMessage;
  }
  return undefined;
}

function validationException(errors: ValidationError[]): BadRequestException {
  return new BadRequestException(
    firstMessage(errors) ?? 'Dữ liệu không hợp lệ',
  );
}

@Injectable()
export class OrderedValidationPipe implements PipeTransform<
  unknown,
  Promise<unknown>
> {
  private readonly stages: ValidationPipe[] = [
    'required',
    'type',
    'length',
    'format',
  ].map(
    (group: string): ValidationPipe =>
      new ValidationPipe({
        groups: [group],
        strictGroups: true,
        stopAtFirstError: true,
        forbidUnknownValues: false,
        exceptionFactory: validationException,
      }),
  );

  private readonly whitelist: ValidationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
    exceptionFactory: validationException,
  });

  async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    // Validate each stage across all fields before proceeding to the next one.
    for (const stage of this.stages) {
      await stage.transform(value, metadata);
    }
    const result: unknown = await this.whitelist.transform(value, metadata);
    return result;
  }
}
