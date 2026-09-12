import pb from '@/lib/pocketbase/client'

export interface NcmCestEntry {
  id?: string
  ncm: string
  cest: string
  descricao: string
  segmento?: string
  item_anexo?: string
  created?: string
  updated?: string
}

// Cache local simples em memória para respostas instantâneas no front-end
let cachedList: NcmCestEntry[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Normaliza código NCM removendo pontos, traços e espaços
 */
export function normalizeNcm(raw?: string): string {
  if (!raw) return ''
  return raw.replace(/\D/g, '')
}

/**
 * Formata NCM para padrão visual NNNN.NN.NN se tiver 8 dígitos
 */
export function formatNcm(raw?: string): string {
  const clean = normalizeNcm(raw)
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}.${clean.slice(4, 6)}.${clean.slice(6, 8)}`
  }
  return clean
}

/**
 * Normaliza código CEST removendo pontos e traços
 */
export function normalizeCest(raw?: string): string {
  if (!raw) return ''
  return raw.replace(/\D/g, '')
}

/**
 * Formata CEST para padrão oficial NN.NNN.NN se tiver 7 dígitos
 */
export function formatCest(raw?: string): string {
  const clean = normalizeCest(raw)
  if (clean.length === 7) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 7)}`
  }
  return raw || ''
}

export const ncmCestService = {
  /**
   * Obtém a lista completa de referências NCM -> CEST (com cache em memória)
   */
  async getAll(): Promise<NcmCestEntry[]> {
    const now = Date.now()
    if (cachedList && now - cacheTimestamp < CACHE_TTL_MS) {
      return cachedList
    }

    try {
      const records = await pb.collection('ncm_cest').getFullList<NcmCestEntry>({
        sort: 'ncm',
      })
      cachedList = records
      cacheTimestamp = now
      return records
    } catch (err) {
      console.error('[ncmCestService] Erro ao carregar tabela ncm_cest:', err)
      return cachedList || []
    }
  },

  /**
   * Busca exata pelo NCM (8 dígitos). Retorna a entrada ou null se não houver CEST definido.
   * Exemplo: '84733042' -> { ncm: '84733042', cest: '21.035.00', ... }
   * Exemplo: '84713012' -> null (não tem CEST)
   */
  async findByNcm(ncmRaw?: string): Promise<NcmCestEntry | null> {
    const cleanNcm = normalizeNcm(ncmRaw)
    if (!cleanNcm || cleanNcm.length < 4) return null

    // 1. Tenta memória primeiro
    if (cachedList) {
      const match = cachedList.find((e) => normalizeNcm(e.ncm) === cleanNcm)
      if (match) return match
    }

    // 2. Busca no PocketBase
    try {
      const record = await pb
        .collection('ncm_cest')
        .getFirstListItem<NcmCestEntry>(`ncm = "${cleanNcm}"`)
      return record
    } catch {
      // Se não encontrou exato e tem 8 dígitos, não tem CEST
      return null
    }
  },

  /**
   * Busca sugestões para autocomplete: busca por dígitos iniciais de NCM ou termos na descrição
   */
  async searchSuggestions(query: string, maxResults = 8): Promise<NcmCestEntry[]> {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const all = await this.getAll()
    const cleanDigits = normalizeNcm(q)

    return all
      .filter((item) => {
        const itemDigits = normalizeNcm(item.ncm)
        const matchDigits = cleanDigits && itemDigits.includes(cleanDigits)
        const matchDesc = item.descricao?.toLowerCase().includes(q)
        const matchCest = item.cest.replace(/\D/g, '').includes(cleanDigits)
        return matchDigits || matchDesc || matchCest
      })
      .slice(0, maxResults)
  },

  /**
   * Limpa cache em memória (caso haja inserções manuais)
   */
  invalidateCache() {
    cachedList = null
    cacheTimestamp = 0
  },
}
