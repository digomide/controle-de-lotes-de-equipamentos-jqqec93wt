import pb from '@/lib/pocketbase/client'

export interface TaxRule {
  id?: string
  categoria: string
  cfop_dentro: string
  cfop_fora: string
  csosn?: string
  cst?: string
  origem?: number
  ncm_sugerido?: string
  cest_sugerido?: string
  ativo: boolean
  created?: string
  updated?: string
}

export type CreateTaxRuleInput = Omit<TaxRule, 'id' | 'created' | 'updated'>
export type UpdateTaxRuleInput = Partial<CreateTaxRuleInput>

export const taxRulesService = {
  /**
   * Lista todas as regras fiscais cadastradas
   */
  async getAll(): Promise<TaxRule[]> {
    try {
      const records = await pb.collection('tax_rules').getFullList<TaxRule>({
        sort: 'categoria',
      })
      return records
    } catch (err) {
      console.error('[taxRulesService] Erro ao listar regras fiscais:', err)
      return []
    }
  },

  /**
   * Obtém regras fiscais ativas
   */
  async getActive(): Promise<TaxRule[]> {
    try {
      const records = await pb.collection('tax_rules').getFullList<TaxRule>({
        filter: 'ativo = true',
        sort: 'categoria',
      })
      return records
    } catch (err) {
      console.error('[taxRulesService] Erro ao listar regras fiscais ativas:', err)
      return []
    }
  },

  /**
   * Busca regra por ID
   */
  async getById(id: string): Promise<TaxRule> {
    return await pb.collection('tax_rules').getOne<TaxRule>(id)
  },

  /**
   * Cria nova regra fiscal por categoria
   */
  async create(data: CreateTaxRuleInput): Promise<TaxRule> {
    return await pb.collection('tax_rules').create<TaxRule>({
      ...data,
      categoria: data.categoria.trim(),
      cfop_dentro: (data.cfop_dentro || '5405').trim(),
      cfop_fora: (data.cfop_fora || '6404').trim(),
      csosn: data.csosn !== undefined ? String(data.csosn).trim() : '500',
      origem: typeof data.origem === 'number' ? data.origem : 0,
      ativo: data.ativo !== false,
    })
  },

  /**
   * Atualiza regra existente
   */
  async update(id: string, data: UpdateTaxRuleInput): Promise<TaxRule> {
    const payload: any = { ...data }
    if (payload.categoria) payload.categoria = payload.categoria.trim()
    if (payload.cfop_dentro) payload.cfop_dentro = payload.cfop_dentro.trim()
    if (payload.cfop_fora) payload.cfop_fora = payload.cfop_fora.trim()
    if (payload.csosn !== undefined) payload.csosn = String(payload.csosn).trim()
    return await pb.collection('tax_rules').update<TaxRule>(id, payload)
  },

  /**
   * Exclui regra fiscal
   */
  async delete(id: string): Promise<boolean> {
    await pb.collection('tax_rules').delete(id)
    return true
  },

  /**
   * Tenta encontrar uma regra correspondente para uma categoria ou texto de produto.
   * Faz correspondência exata ou por similaridade na string (case-insensitive).
   */
  matchRule(rules: TaxRule[], categoryOrDescription?: string): TaxRule | null {
    if (!categoryOrDescription || !rules || rules.length === 0) return null
    const text = categoryOrDescription.toLowerCase().trim()

    // 1. Busca exata de categoria
    const exact = rules.find((r) => r.categoria.toLowerCase().trim() === text)
    if (exact) return exact

    // 2. Busca por palavra-chave da categoria no texto do produto
    // Ex: "Memória" -> se contém "memória", "memoria", "ram", "ddr"
    for (const rule of rules) {
      const catLower = rule.categoria.toLowerCase().trim()
      if (text.includes(catLower)) return rule

      // Mapeamentos comuns para categorias de TI
      if (catLower.includes('memória') || catLower.includes('memoria')) {
        if (
          text.includes('memória') ||
          text.includes('memoria') ||
          text.includes('ddr3') ||
          text.includes('ddr4') ||
          text.includes('ddr5') ||
          text.includes('sodimm')
        ) {
          return rule
        }
      }
      if (catLower.includes('notebook')) {
        if (
          text.includes('notebook') ||
          text.includes('laptop') ||
          text.includes('thinkpad') ||
          text.includes('latitude') ||
          text.includes('inspiron')
        ) {
          return rule
        }
      }
      if (catLower.includes('hd') || catLower.includes('ssd')) {
        if (
          text.includes('ssd') ||
          text.includes('nvme') ||
          text.includes('disco rígido') ||
          text.includes('hd ')
        ) {
          return rule
        }
      }
    }

    return null
  },
}
