import { BadRequestException } from '@nestjs/common';

import { listResponse, parseListPage } from './pagination';

describe('list pagination', () => {
  it('keeps the historical list when page and limit are omitted', () => {
    expect(parseListPage(undefined, undefined)).toBeUndefined();
    expect(parseListPage('', '')).toBeUndefined();
  });

  it('rejects a page below 1 and a limit above 100', () => {
    expect(() => parseListPage('0', '10')).toThrow(BadRequestException);
    expect(() => parseListPage('1', '101')).toThrow(BadRequestException);
    expect(() => parseListPage('1.5', '10')).toThrow(BadRequestException);
  });

  it('returns an empty page and the next page boundary', () => {
    const first = parseListPage('1', '2');
    const second = parseListPage(undefined, '2');
    const later = parseListPage('3', '2');
    expect(first).toEqual({ page: 1, limit: 2, offset: 0 });
    expect(second).toEqual({ page: 1, limit: 2, offset: 0 });
    expect(later).toEqual({ page: 3, limit: 2, offset: 4 });
    expect(listResponse([], later!, 0)).toEqual({
      data: [],
      page: 3,
      limit: 2,
      total: 0,
    });
    expect(listResponse([{ id: 'c' }], later!, 5)).toEqual({
      data: [{ id: 'c' }],
      page: 3,
      limit: 2,
      total: 5,
    });
  });
});
