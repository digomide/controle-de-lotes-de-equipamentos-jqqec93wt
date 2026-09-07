import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Retorna a URL base do backend PocketBase conectada ao app.
 * Utiliza VITE_POCKETBASE_URL e faz fallback seguro para a baseUrl do cliente PocketBase configurado.
 */
export function getPocketBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_POCKETBASE_URL || '').trim()
  if (envUrl) {
    return envUrl.replace(/\/+$/, '')
  }
  const clientBase = (pb.baseUrl || '').trim()
  if (clientBase) {
    return clientBase.replace(/\/+$/, '')
  }
  return ''
}

export default pb
