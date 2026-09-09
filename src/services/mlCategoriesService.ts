import pb from '@/lib/pocketbase/client'

export interface MLCategoryRecord {
  id: string
  category_id: string
  name: string
  parent_id?: string
  family_id?: string
  family_name?: string
  subfamily_id?: string
  subfamily_name?: string
  full_path?: string
  level?: number
  is_leaf?: boolean
  total_items_in_this_category?: number
}

export interface MLCategoryNode {
  category_id: string
  name: string
  level: number
  parent_id?: string
  family_id?: string
  family_name?: string
  subfamily_id?: string
  subfamily_name?: string
  full_path: string
  is_leaf: boolean
  children?: MLCategoryNode[]
}

/**
 * Cache em memória durante a sessão para evitar requisições repetidas ao banco
 */
let cachedCategories: MLCategoryRecord[] | null = null

/**
 * Lista estática das principais famílias do Mercado Livre Brasil com IDs canônicos MLB
 * Serve de fallback imediato caso a tabela ainda esteja populando ou offline.
 */
export const TOP_ML_FAMILIES: MLCategoryRecord[] = [
  { id: 'MLB1648', category_id: 'MLB1648', name: 'Informática', level: 1 },
  { id: 'MLB1051', category_id: 'MLB1051', name: 'Celulares e Telefones', level: 1 },
  { id: 'MLB1000', category_id: 'MLB1000', name: 'Eletrônicos, Áudio e Vídeo', level: 1 },
  { id: 'MLB1499', category_id: 'MLB1499', name: 'Indústria e Comércio', level: 1 },
  { id: 'MLB5726', category_id: 'MLB5726', name: 'Eletrodomésticos', level: 1 },
  { id: 'MLB1144', category_id: 'MLB1144', name: 'Games', level: 1 },
]

export const mlCategoriesService = {
  /**
   * Obtém todas as categorias do banco PocketBase
   */
  async getAll(): Promise<MLCategoryRecord[]> {
    if (cachedCategories && cachedCategories.length > 0) {
      return cachedCategories
    }
    try {
      const records = await pb.collection('ml_categories').getFullList<MLCategoryRecord>({
        sort: 'level,name',
      })
      cachedCategories = records || []
      return cachedCategories
    } catch (err) {
      console.warn('[mlCategoriesService] Falha ao carregar ml_categories:', err)
      return []
    }
  },

  /**
   * Obtém a lista agrupada em famílias (nível 1) e suas sub-famílias (nível 2+)
   */
  async getTree(): Promise<{
    families: Array<{
      id: string
      category_id: string
      name: string
      subfamilies: MLCategoryRecord[]
    }>
    allRecords: MLCategoryRecord[]
  }> {
    const all = await this.getAll()
    const level1 = all.filter((c) => !c.level || c.level === 1 || !c.parent_id)
    const families = level1.map((fam) => {
      const subfamilies = all.filter(
        (c) =>
          (c.family_id === fam.category_id || c.parent_id === fam.category_id) &&
          c.category_id !== fam.category_id,
      )
      return {
        id: fam.id,
        category_id: fam.category_id,
        name: fam.name,
        subfamilies,
      }
    })

    return {
      families,
      allRecords: all,
    }
  },

  /**
   * Obtém as famílias principais (nível 1)
   */
  async getTopFamilies(): Promise<MLCategoryRecord[]> {
    const all = await this.getAll()
    const top = all.filter((c) => !c.level || c.level === 1 || !c.parent_id)
    return top.length > 0 ? top : TOP_ML_FAMILIES
  },

  /**
   * Obtém sub-famílias (nível 2) de uma família pai
   */
  async getSubfamilies(parentCategoryId: string): Promise<MLCategoryRecord[]> {
    if (!parentCategoryId) return []
    const all = await this.getAll()
    return all.filter(
      (c) =>
        (c.family_id === parentCategoryId || c.parent_id === parentCategoryId) &&
        c.category_id !== parentCategoryId,
    )
  },

  /**
   * Obtém categorias folhas ou filhas de uma subfamília
   */
  async getLeafCategories(subfamilyCategoryId: string): Promise<MLCategoryRecord[]> {
    if (!subfamilyCategoryId) return []
    const all = await this.getAll()
    return all.filter(
      (c) =>
        (c.parent_id === subfamilyCategoryId || c.subfamily_id === subfamilyCategoryId) &&
        c.category_id !== subfamilyCategoryId,
    )
  },

  /**
   * Busca categorias por texto no nome ou full_path
   */
  async searchCategories(query: string, limit = 20): Promise<MLCategoryRecord[]> {
    if (!query || !query.trim()) return []
    const clean = query.trim().toLowerCase()
    const all = await this.getAll()
    const matches = all.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(clean)) ||
        (c.full_path && c.full_path.toLowerCase().includes(clean)) ||
        c.category_id.toLowerCase().includes(clean),
    )
    return matches.slice(0, limit)
  },

  /**
   * Classifica heurísticamente a sub-família a partir do título do produto ou especificação.
   * Usado para garantir que anúncios coletados e do catálogo (mesmo sem category_id no item)
   * ganhem uma sub-família honesta e clara.
   */
  classifySubfamily(title: string, rawSubfamily?: string): string {
    if (rawSubfamily && rawSubfamily.trim()) {
      return rawSubfamily.trim()
    }
    const clean = (title || '').toLowerCase()
    if (!clean) return 'Sem família'

    // 1. Notebooks / Laptops / Portáteis
    if (
      /\b(notebook|notebooks|laptop|laptops|sodimm|so-dimm|thinkpad|inspiron|latitude|macbook|ultrabook|para notebook|de notebook)\b/i.test(
        clean,
      )
    ) {
      return 'Notebook'
    }

    // 2. Desktops / Computadores de mesa / Servidores
    if (
      /\b(desktop|desktops|computador|pc|optiplex|prodesk|elitedesk|thinkcentre|servidor|server|micro|tiny|sff|dimm|udimm|para desktop|de desktop|para pc)\b/i.test(
        clean,
      )
    ) {
      return 'Desktop'
    }

    // 3. Monitores / Telas externas
    if (/\b(monitor|monitores|displayport|hdmi tela|polegadas|ips|led tela)\b/i.test(clean)) {
      return 'Monitor'
    }

    // 4. Tablets
    if (/\b(tablet|tablets|ipad|galaxy tab)\b/i.test(clean)) {
      return 'Tablet'
    }

    // 5. Celulares / Smartphones
    if (/\b(celular|celulares|smartphone|smartphones|iphone|xiaomi|motorola)\b/i.test(clean)) {
      return 'Celular / Smartphone'
    }

    // 6. Peças / Componentes de Hardware genéricos
    if (/\b(placa mae|placa-mae|processador|fonte|memoria ram|ssd|nvme|cooler)\b/i.test(clean)) {
      return 'Peças / Hardware'
    }

    return 'Geral'
  },
}
