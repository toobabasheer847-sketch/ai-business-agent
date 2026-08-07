export interface ApiResponse<T = unknown> {
  data: T;
  statusCode: number;
  message?: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Auditable {
  createdAt?: string;
  updatedAt?: string;
}

export interface WithTenant {
  tenantId: string;
}
