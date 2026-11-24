import { apiClient } from '@/lib/api'
import type {
  BusinessOverview,
  ForecastView,
  InsightView,
  LeadInsights,
  PipelineBucket,
  RiskView,
  WorkloadView,
} from '@/features/business-intelligence/types/business-intelligence.types'

export type BusinessParams = {
  range?: string
  from?: string
  to?: string
  horizon?: string
}

export const businessIntelligenceApi = {
  overview: async (params: BusinessParams) =>
    (await apiClient.get<BusinessOverview>('/business-intelligence/overview', { params })).data,
  salesForecast: async (params: BusinessParams) =>
    (await apiClient.get<{ forecasts: ForecastView[] }>('/business-intelligence/sales-forecast', { params })).data,
  leadInsights: async (params: BusinessParams) =>
    (await apiClient.get<LeadInsights>('/business-intelligence/lead-insights', { params })).data,
  revenuePipeline: async (params: BusinessParams) =>
    (await apiClient.get<{ pipeline: PipelineBucket[]; note: string }>('/business-intelligence/revenue-pipeline', { params })).data,
  workloadForecast: async (params: BusinessParams) =>
    (await apiClient.get<WorkloadView>('/business-intelligence/workload-forecast', { params })).data,
  risks: async (params: BusinessParams) =>
    (await apiClient.get<{ risks: RiskView[] }>('/business-intelligence/risks', { params })).data,
  insights: async (params: BusinessParams) =>
    (await apiClient.get<{ insights: InsightView[]; note: string }>('/business-intelligence/insights', { params })).data,
  refresh: async (params: BusinessParams) =>
    (await apiClient.post<{ savedForecasts: number; savedInsights: number; evaluated: number }>('/business-intelligence/refresh', null, { params })).data,
}
