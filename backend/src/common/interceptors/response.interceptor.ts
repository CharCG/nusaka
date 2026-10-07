import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../dto/response.dto.js';
import { Paginated } from '../dto/paginated-response.dto.js';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<unknown> | undefined> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<unknown> | undefined> {
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      map((data) => {
        if (response.statusCode === HttpStatus.NO_CONTENT) {
          return undefined;
        }

        if (data instanceof Paginated) {
          return {
            success: true,
            statusCode: response.statusCode,
            message: 'Success',
            data: data.items,
            meta: data.meta,
          };
        }

        return {
          success: true,
          statusCode: response.statusCode,
          message: 'Success',
          data: data ?? null,
        };
      }),
    );
  }
}
