import type { SortDirection } from '../dto/filter.dto';

export interface IntegrationFilter {
  search?: string;
  sortBy?: string;
  sortDir?: SortDirection;
  dateFrom?: string;
  dateTo?: string;
}

export interface ChannelPayload {
  channel: string;
  message: string;
}
