import pb from '@/lib/pocketbase/client'

export interface NFConfig {
  id?: string
  focus_token?: string
  environment: 'homologacao' | 'producao'
  certificate_file?: string
  certificate_password?: string
  certificate_status?: string
  certificate_expires_at?: string
  cnpj?: string
  razao_social?: string
  nome_fantasia?: string
  inscricao_estadual?: string
  regime_tributario?: '1' | '2' | '3'
  cnae?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
  telefone?: string
  email?: string
  serie_nfe?: string
  proximo_numero_nfe?: number
  default_ncm?: string
  default_cfop_estadual?: string
  default_cfop_interestadual?: string
  default_csosn?: string
  natureza_operacao_padrao?: string
  informacoes_complementares_padrao?: string
}

export interface NFItem {
  codigo_produto?: string
  sku?: string
  descricao: string
  categoria?: string
  ncm: string
  cest?: string
  cfop: string
  csosn?: string
  cst_icms?: string
  pis_cst?: string
  cofins_cst?: string
  ipi_cst?: string
  origem?: number
  quantidade: number
  valor_unitario: number
  valor_total: number
}

export interface NFDestinatario {
  nome_completo: string
  cpf?: string
  cnpj?: string
  documento?: string
  email?: string
  telefone?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
}

export interface NFInvoice {
  id: string
  ref: string
  origin_type: 'ml_order' | 'sale_internal' | 'manual'
  ml_order_id?: string
  sale_id?: string
  status: 'rascunho' | 'processando' | 'autorizada' | 'rejeitada' | 'cancelada' | 'erro_transmissao'
  status_sefaz?: string
  mensagem_sefaz?: string
  numero?: string
  serie?: string
  chave_nfe?: string
  protocolo_autorizacao?: string
  caminho_danfe?: string
  caminho_xml_nota_fiscal?: string
  natureza_operacao?: string
  valor_total: number
  destinatario?: NFDestinatario
  itens?: NFItem[]
  informacoes_complementares?: string
  focus_payload?: any
  focus_response?: any
  created_by?: string
  created: string
  updated: string
}

export interface EmitNFInput {
  origin_type: 'ml_order' | 'sale_internal' | 'manual'
  ml_order_id?: string
  sale_id?: string
  ref?: string
  destinatario: NFDestinatario
  itens: NFItem[]
  natureza_operacao?: string
  informacoes_complementares?: string
}

export const nfService = {
  /**
   * Obtém as configurações da empresa emissora e da Focus NFe
   */
  async getConfig(): Promise<NFConfig | null> {
    try {
      // Sempre buscar o primeiro registro existente (singleton de configuração)
      const records = await pb.collection('nf_config').getList<NFConfig>(1, 1)
      if (records.items && records.items.length > 0) {
        return records.items[0]
      }
      return null
    } catch (err) {
      console.error('[nfService] Erro ao buscar nf_config:', err)
      throw err
    }
  },

  /**
   * Salva ou atualiza as configurações da empresa emissora.
   * Garante a semântica singleton: sempre atualiza o registro único existente
   * e apenas cria se a coleção estiver absolutamente vazia.
   */
  async saveConfig(data: Partial<NFConfig>, certificateFile?: File): Promise<NFConfig> {
    // 1. Identificar o id do registro existente: pelo input data.id ou buscando na coleção
    let targetId = data.id
    if (!targetId) {
      const existing = await this.getConfig()
      if (existing?.id) {
        targetId = existing.id
      }
    }

    const formData = new FormData()
    for (const [key, val] of Object.entries(data)) {
      // Ignorar id, created, updated, collectionId, collectionName e certificate_file se string
      if (
        key === 'id' ||
        key === 'created' ||
        key === 'updated' ||
        key === 'collectionId' ||
        key === 'collectionName' ||
        key === 'certificate_file'
      ) {
        continue
      }
      if (val !== undefined && val !== null) {
        formData.append(key, String(val))
      }
    }

    if (certificateFile) {
      formData.append('certificate_file', certificateFile)
    }

    if (targetId) {
      const updated = await pb.collection('nf_config').update<NFConfig>(targetId, formData)
      return updated
    } else {
      // Se a coleção estiver vazia, cria o primeiro e único registro
      const created = await pb.collection('nf_config').create<NFConfig>(formData)
      return created
    }
  },

  /**
   * Lista histórico de notas fiscais emitidas
   */
  async getInvoices(params?: {
    page?: number
    perPage?: number
    filter?: string
    sort?: string
  }): Promise<{ items: NFInvoice[]; totalItems: number }> {
    const page = params?.page || 1
    const perPage = params?.perPage || 50
    const sort = params?.sort || '-created'
    const filter = params?.filter || ''

    const res = await pb.collection('nf_invoices').getList<NFInvoice>(page, perPage, {
      sort,
      filter,
    })

    return {
      items: res.items,
      totalItems: res.totalItems,
    }
  },

  /**
   * Busca nota fiscal pelo ID
   */
  async getInvoiceById(id: string): Promise<NFInvoice> {
    return await pb.collection('nf_invoices').getOne<NFInvoice>(id)
  },

  /**
   * Busca nota fiscal vinculada a um pedido do Mercado Livre
   */
  async getInvoiceByMLOrder(orderId: string): Promise<NFInvoice | null> {
    try {
      const records = await pb.collection('nf_invoices').getList<NFInvoice>(1, 1, {
        filter: `ml_order_id = '${orderId}'`,
        sort: '-created',
      })
      return records.items[0] || null
    } catch {
      return null
    }
  },

  /**
   * Busca nota fiscal vinculada a uma venda interna
   */
  async getInvoiceBySale(saleId: string): Promise<NFInvoice | null> {
    try {
      const records = await pb.collection('nf_invoices').getList<NFInvoice>(1, 1, {
        filter: `sale_id = '${saleId}'`,
        sort: '-created',
      })
      return records.items[0] || null
    } catch {
      return null
    }
  },

  /**
   * Transmite a emissão de uma NF-e via hook backend Focus NFe
   */
  async emitInvoice(input: EmitNFInput): Promise<{
    ok: boolean
    invoice_id: string
    ref: string
    status: string
    mensagem: string
    chave_nfe?: string
    numero?: string
    caminho_danfe?: string
  }> {
    const res = await pb.send('/backend/v1/nf/emit', {
      method: 'POST',
      body: input,
    })
    return res
  },

  /**
   * Consulta status atualizado da NF-e na SEFAZ via Focus
   */
  async consultStatus(ref: string): Promise<{
    ok: boolean
    status: string
    numero?: string
    chave_nfe?: string
    caminho_danfe?: string
    caminho_xml?: string
    mensagem?: string
  }> {
    const res = await pb.send(`/backend/v1/nf/status/${encodeURIComponent(ref)}`, {
      method: 'GET',
    })
    return res
  },
}
