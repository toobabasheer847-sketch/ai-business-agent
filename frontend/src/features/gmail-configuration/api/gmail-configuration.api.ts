import { ApiError, apiClient } from '@/lib/api'
import type {
  GmailConfiguration,
  CreateGmailConfigurationRequest,
  UpdateGmailConfigurationRequest,
  DeleteGmailConfigurationResponse,
} from '@/features/gmail-configuration/types/gmail-configuration.types'

/**
 * Gmail Configuration API endpoints
 * All endpoints are tenant-scoped via JWT authentication.
 */
export const gmailConfigurationApi = {
  /**
   * GET /api/gmail-configuration
   * Retrieve the current tenant's Gmail configuration.
   * Backend returns 404 when none exists — treat that as null (empty state).
   */
  getConfiguration() {
    return apiClient
      .get<GmailConfiguration>('/gmail-configuration')
      .then((response) => response.data)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          return null
        }
        throw error
      })
  },

  /**
   * POST /api/gmail-configuration
   * Create a new Gmail configuration for the tenant.
   * Only one configuration per tenant is allowed.
   * Throws 409 if a configuration already exists.
   */
  createConfiguration(payload: CreateGmailConfigurationRequest) {
    return apiClient
      .post<GmailConfiguration>('/gmail-configuration', payload)
      .then((response) => response.data)
  },

  /**
   * PATCH /api/gmail-configuration
   * Update the current tenant's Gmail configuration.
   * Partial update — only provided fields are changed.
   * Throws 404 if no configuration exists.
   */
  updateConfiguration(payload: UpdateGmailConfigurationRequest) {
    return apiClient
      .patch<GmailConfiguration>('/gmail-configuration', payload)
      .then((response) => response.data)
  },

  /**
   * PATCH /api/gmail-configuration/deactivate
   * Soft-deactivate the Gmail configuration without deleting credentials.
   * Throws 404 if no configuration exists.
   */
  deactivateConfiguration() {
    return apiClient
      .patch<GmailConfiguration>('/gmail-configuration/deactivate')
      .then((response) => response.data)
  },

  /**
   * DELETE /api/gmail-configuration
   * Permanently delete the tenant's Gmail configuration and all stored credentials.
   * Throws 404 if no configuration exists.
   */
  deleteConfiguration() {
    return apiClient
      .delete<DeleteGmailConfigurationResponse>('/gmail-configuration')
      .then((response) => response.data)
  },
}
