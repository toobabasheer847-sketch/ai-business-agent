import { BadRequestException } from '@nestjs/common';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export type PageBounds = {
  page: number;
  limit: number;
  offset: number;
};

export type PageResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

/**
 * Omitted page and limit keep the historical array response.
 * Either value opts into `{ data, page, limit, total }`.
 */
export function parseListPage(page?: string, limit?: string): PageBounds | undefined {
  const pageBlank = page === undefined || page === '';
  const limitBlank = limit === undefined || limit === '';
  if (pageBlank && limitBlank) return undefined;

  const pageNumber = pageBlank ? 1 : Number(page);
  const limitNumber = limitBlank ? DEFAULT_PAGE_SIZE : Number(limit);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new BadRequestException('page must be an integer greater than or equal to 1.');
  }
  if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > MAX_PAGE_SIZE) {
    throw new BadRequestException(`limit must be an integer from 1 to ${MAX_PAGE_SIZE}.`);
  }

  return {
    page: pageNumber,
    limit: limitNumber,
    offset: (pageNumber - 1) * limitNumber,
  };
}

export function listResponse<T>(data: T[], page: PageBounds, total: number): PageResult<T> {
  return {
    data,
    page: page.page,
    limit: page.limit,
    total,
  };
}
