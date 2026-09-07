import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export function getPocketBaseUrl(): string {
  return (
    import.meta.env.VITE_POCKETBASE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  )
}

export default pb
