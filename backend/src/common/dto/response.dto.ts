import type { PaginationMeta } from './paginated-response.dto.js';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  meta?: PaginationMeta;
}
