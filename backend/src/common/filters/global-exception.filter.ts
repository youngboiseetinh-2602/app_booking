import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  path: string;
  timestamp: string;
  errorCode?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter<unknown> {
  private readonly logger: Logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request: Request = context.getRequest<Request>();
    const response: Response = context.getResponse<Response>();
    const statusCode: number = this.getStatus(exception);
    const body: ErrorResponse = {
      statusCode,
      message: this.getMessage(exception, statusCode),
      path: request.path,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof HttpException && statusCode < 500) {
      const details: string | object = exception.getResponse();
      const errorCode: unknown =
        typeof details === 'object' &&
        details !== null &&
        'errorCode' in details
          ? details.errorCode
          : exception.errorCode;
      if (typeof errorCode === 'string') body.errorCode = errorCode;
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.path} ${statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    if (response.headersSent) {
      response.end();
      return;
    }
    response.status(statusCode).json(body);
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    // Express middleware can throw HTTP errors outside Nest's exception classes.
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'statusCode' in exception &&
      typeof exception.statusCode === 'number' &&
      Number.isInteger(exception.statusCode) &&
      exception.statusCode >= 400 &&
      exception.statusCode <= 599
    ) {
      return exception.statusCode;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(
    exception: unknown,
    statusCode: number,
  ): string | string[] {
    if (statusCode >= 500) return 'Internal server error';
    if (exception instanceof HttpException) {
      const details: string | object = exception.getResponse();
      if (typeof details === 'string') return details;
      if (details !== null && 'message' in details) {
        const message: unknown = details.message;
        if (typeof message === 'string') return message;
        if (
          Array.isArray(message) &&
          message.every(
            (item: unknown): item is string => typeof item === 'string',
          )
        ) {
          return message;
        }
      }
      return exception.message;
    }
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'message' in exception &&
      typeof exception.message === 'string'
    ) {
      return exception.message;
    }
    return 'Request failed';
  }
}
