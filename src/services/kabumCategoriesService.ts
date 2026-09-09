import pb from '@/lib/pocketbase/client'
import type { KabumCategoryRecord, KabumCategoryNode } from '@/types/kabum'

/**
 * Categorias canônicas padrão do ecossistema de informática/hardware Kabum/Mirakl
 * Usadas como fallback imediato ou quando offline.
 */
export const DEFAULT_KABUM_CATEGORIES = [
  {
    family_id: 'hardware',
    family_name: 'Hardware',
    subfamily_id: 'processadores',
    subfamily_name: 'Processadores',
    categories: [
      { id: 'proc-intel', name: 'Intel Core' },
      { id: 'proc-amd', name: 'AMD Ryzen' },
    ],
  },
  {
    family_id: 'computadores',
    family_name: 'Computadores & Notebooks',
    subfamily_id: 'notebooks',
    subfamily_name: 'Notebooks',
    categories: [
      { id: 'nb-usados-recond', name: 'Notebooks Usados e Recondicionados' },
      { id: 'nb-corporativo', name: 'Notebooks Corporativos' },
      { id: 'nb-gamer', name: 'Notebooks Gamer' },
      { id: 'nb-ultrabook', name: 'Ultrabooks' },
    ],
  },
  {
    family_id: 'computadores',
    family_name: 'Computadores & Notebooks',
    subfamily_id: 'desktops',
    subfamily_name: 'Desktops & Workstations',
    categories: [
      { id: 'desk-corp', name: 'Desktops Corporativos' },
      { id: 'desk-allinone', name: 'Computadores All In One' },
    ],
  },
  {
    family_id: 'perifericos',
    family_name: 'Periféricos',
    subfamily_id: 'monitores',
    subfamily_name: 'Monitores',
    categories: [
      { id: 'mon-led', name: 'Monitores LED / IPS' },
      { id: 'mon-gamer', name: 'Monitores Gamer' },
    ],
  },
  {
    family_id: 'armazenamento-memoria',
    family_name: 'Memória & Armazenamento',
    subfamily_id: 'memorias',
    subfamily_name: 'Memórias RAM',
    categories: [
      { id: 'ram-ddr4-sodimm', name: 'Memória Notebook DDR4 SODIMM' },
      { id: 'ram-ddr5-sodimm', name: 'Memória Notebook DDR5 SODIMM' },
      { id: 'ram-desktop', name: 'Memória Desktop DIMM' },
    ],
  },
  {
    family_id: 'armazenamento-memoria',
    family_name: 'Memória & Armazenamento',
    subfamily_id: 'ssd',
    subfamily_name: 'SSDs & Discos Rígidos',
    categories: [
      { id: 'ssd-nvme', name: 'SSD M.2 NVMe' },
      { id: 'ssd-sata', name: 'SSD SATA 2.5' },
    ],
  },
]

export const kabumCategoriesService = {
  /**
   * Retorna as categorias do Kabum armazenadas no PocketBase.
   */
  async getAll(): Promise<KabumCategoryRecord[]> {
    try {
      const records = await pb.collection('kabum_categories').getFullList<KabumCategoryRecord>({
        sort: 'level,name',
      })
      return records
    } catch (err) {
      console.warn('[kabumCategoriesService] Erro ao buscar categorias do banco:', err)
      return []
    }
  },

  /**
   * Converte a lista plana de categorias em nós hierárquicos para seletores em cascata
   */
  buildCategoryHierarchy(records: KabumCategoryRecord[]): {
    families: { id: string; name: string }[]
    getSubfamilies: (familyId: string) => { id: string; name: string }[]
    getCategories: (familyId: string, subfamilyId: string) => KabumCategoryRecord[]
  } {
    if (!records || records.length === 0) {
      // Usa os defaults para manter UI viva
      const families = DEFAULT_KABUM_CATEGORIES.map((f) => ({
        id: f.family_id,
        name: f.family_name,
      })).filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx)

      return {
        families,
        getSubfamilies: (fId: string) => {
          return DEFAULT_KABUM_CATEGORIES.filter((d) => d.family_id === fId).map((d) => ({
            id: d.subfamily_id,
            name: d.subfamily_name,
          }))
        },
        getCategories: (fId: string, subId: string) => {
          const found = DEFAULT_KABUM_CATEGORIES.find(
            (d) => d.family_id === fId && d.subfamily_id === subId,
          )
          if (!found) return []
          return found.categories.map((c) => ({
            id: c.id,
            category_id: c.id,
            name: c.name,
            family_id: fId,
            family_name: found.family_name,
            subfamily_id: subId,
            subfamily_name: found.subfamily_name,
            full_path: `${found.family_name} > ${found.subfamily_name} > ${c.name}`,
            level: 3,
            is_leaf: true,
          }))
        },
      }
    }

    const familiesMap = new Map<string, string>()
    records.forEach((r) => {
      const famId = r.family_id || 'geral'
      const famName = r.family_name || 'Geral'
      familiesMap.set(famId, famName)
    })

    const families = Array.from(familiesMap.entries()).map(([id, name]) => ({ id, name }))

    return {
      families,
      getSubfamilies: (familyId: string) => {
        const subMap = new Map<string, string>()
        records
          .filter((r) => r.family_id === familyId && r.subfamily_id)
          .forEach((r) => {
            subMap.set(r.subfamily_id!, r.subfamily_name || r.subfamily_id!)
          })
        return Array.from(subMap.entries()).map(([id, name]) => ({ id, name }))
      },
      getCategories: (familyId: string, subfamilyId: string) => {
        return records.filter(
          (r) =>
            r.family_id === familyId &&
            (!subfamilyId || r.subfamily_id === subfamilyId || !r.subfamily_id),
        )
      },
    }
  },

  /**
   * Dispara sincronização com a API Mirakl (H11/PM11)
   */
  async syncFromMirakl(): Promise<{ ok: boolean; count?: number; message?: string }> {
    try {
      const resp = await pb.send('/backend/v1/kabum/categories/sync', {
        method: 'POST',
      })
      return resp
    } catch (err: any) {
      console.error('[kabumCategoriesService] Erro ao sincronizar:', err)
      return {
        ok: false,
        message: err?.message || 'Falha na requisição de sincronização com o Kabum.',
      }
    }
  },
}
