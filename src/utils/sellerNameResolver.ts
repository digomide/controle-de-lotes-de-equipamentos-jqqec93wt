import { mlCatalogService } from '@/services/mlCatalogService'

export const OWN_SELLER_ID = '626774396'
export const OWN_SELLER_NICKNAME = 'INFOPRECOBAIXO'

// Cache em memória compartilhado durante a sessão da aplicação
const sellerNameCache = new Map<string, string>()

// Pré-popula conta própria no cache
sellerNameCache.set(OWN_SELLER_ID, OWN_SELLER_NICKNAME)

/**
 * Verifica se o seller representa a conta própria
 */
export function isOwnSeller(sellerId?: string | number | null, nickname?: string | null): boolean {
  if (sellerId != null && String(sellerId).trim() === OWN_SELLER_ID) {
    return true
  }
  if (nickname && nickname.trim().toUpperCase() === OWN_SELLER_NICKNAME) {
    return true
  }
  return false
}

/**
 * Formata o nome de exibição do vendedor respeitando a precedência:
 * 1. Conta própria (seller_id === '626774396' ou nickname INFOPRECOBAIXO) -> "Sua conta" (ou customizado)
 * 2. Nickname informado/gravado
 * 3. Nickname resolvido do cache/endpoint
 * 4. Fallback: Seller #{id} ou Concorrente/Vendedor
 */
export function formatSellerDisplayName(
  sellerId?: string | number | null,
  nickname?: string | null,
  resolvedMap?: Record<string, string>,
  fallbackLabel?: string,
): {
  displayName: string
  isOwn: boolean
} {
  const cleanId = sellerId != null ? String(sellerId).trim() : ''
  const cleanNick = nickname != null ? String(nickname).trim() : ''

  if (isOwnSeller(cleanId, cleanNick)) {
    return {
      displayName: 'Sua conta',
      isOwn: true,
    }
  }

  if (cleanNick && cleanNick !== 'Não informado' && !cleanNick.startsWith('Seller #')) {
    return {
      displayName: cleanNick,
      isOwn: false,
    }
  }

  const cached =
    (resolvedMap && cleanId ? resolvedMap[cleanId] : '') || sellerNameCache.get(cleanId)
  if (cached && cached.trim()) {
    const isCachedOwn = isOwnSeller(cleanId, cached)
    return {
      displayName: isCachedOwn ? 'Sua conta' : cached.trim(),
      isOwn: isCachedOwn,
    }
  }

  if (cleanId && !cleanId.startsWith('nick_') && cleanId !== 'unknown_seller') {
    return {
      displayName: `Seller #${cleanId}`,
      isOwn: false,
    }
  }

  return {
    displayName: fallbackLabel || 'Concorrente',
    isOwn: false,
  }
}

/**
 * Resolve em lote os seller_ids que ainda não estão presentes no cache em memória.
 * Retorna um Record<string, string> acumulado com todos os nomes conhecidos.
 * Falhas de rede nunca disparam exceção (try/catch seguro).
 */
export async function resolveMissingSellerNames(
  sellerIds: Array<string | number | null | undefined>,
): Promise<Record<string, string>> {
  const missingIds: string[] = []

  for (const raw of sellerIds) {
    if (raw == null) continue
    const sId = String(raw).trim()
    if (!sId || sId.startsWith('nick_') || sId === 'unknown_seller') continue

    if (sId === OWN_SELLER_ID) {
      sellerNameCache.set(sId, OWN_SELLER_NICKNAME)
      continue
    }

    if (!sellerNameCache.has(sId)) {
      missingIds.push(sId)
    }
  }

  if (missingIds.length > 0) {
    try {
      const resolved = await mlCatalogService.resolveSellerNames(missingIds)
      if (resolved && typeof resolved === 'object') {
        for (const [id, nick] of Object.entries(resolved)) {
          if (nick && typeof nick === 'string' && nick.trim()) {
            sellerNameCache.set(id, nick.trim())
          }
        }
      }
    } catch (err) {
      console.warn('[sellerNameResolver] Falha ao resolver seller names:', err)
    }
  }

  const result: Record<string, string> = {}
  for (const [id, nick] of sellerNameCache.entries()) {
    result[id] = nick
  }
  return result
}

/**
 * Retorna o mapa atual do cache em memória síncrono.
 */
export function getCachedSellerNames(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [id, nick] of sellerNameCache.entries()) {
    result[id] = nick
  }
  return result
}
