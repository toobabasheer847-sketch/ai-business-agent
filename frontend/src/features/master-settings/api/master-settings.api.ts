import { apiClient } from '@/lib/api'
import type {
  MasterSettings,
  UpdateMasterSettingsRequest,
} from '@/features/master-settings/types/master-settings.types'

export const masterSettingsApi = {
  get() {
    return apiClient
      .get<MasterSettings>('/master-settings')
      .then((r) => r.data)
  },

  update(payload: UpdateMasterSettingsRequest) {
    return apiClient
      .patch<MasterSettings>('/master-settings', payload)
      .then((r) => r.data)
  },
}
