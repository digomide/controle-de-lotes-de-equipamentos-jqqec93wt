import PocketBase from 'pocketbase'
import { TENANT_STORAGE_KEY } from '@/utils/tenantResolver'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

pb.beforeSend = function (url, options) {
  try {
    let activeTenantId = ''
    try {
      activeTenantId =
        localStorage.getItem(TENANT_STORAGE_KEY) ||
        localStorage.getItem('controle_lotes_selected_tenant_id') ||
        ''
    } catch {
      /* intentionally ignored */
    }

    if (!activeTenantId) {
      const user = pb.authStore?.record || pb.authStore?.model
      if (user && (user as any).tenant_id) {
        activeTenantId = String((user as any).tenant_id).trim()
      }
    }

    if (activeTenantId) {
      options.headers = Object.assign({}, options.headers, {
        'x-tenant-id': activeTenantId,
      })
    }
  } catch {
    /* intentionally ignored */
  }
  return { url, options }
}

export default pb
