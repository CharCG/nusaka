import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal Server Error';

    if (isHttpException) {
      const error = exception.getResponse();

      if (typeof error === 'string') {
        message = error;
      } else {
        const errorMessage = (error as { message?: string | string[] }).message;

        message = Array.isArray(errorMessage)
          ? (errorMessage[0] ?? exception.message)
          : (errorMessage ?? exception.message);
      }
    } else {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unknown Error',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      data: null,
    });
  }
}
