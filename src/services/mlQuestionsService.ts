import pb from '@/lib/pocketbase/client'

export type MLQuestionQueueStatus = 'unanswered' | 'auto_replied' | 'answered'

export interface MLQuestionRecord {
  id: string
  question_id: string
  item_id: string
  item_title: string
  item_permalink: string
  item_thumbnail: string
  item_price: number
  buyer_id: string
  buyer_nickname: string
  text: string
  date_created: string
  status_ml: string
  queue_status: MLQuestionQueueStatus
  initial_auto_reply_sent: boolean
  initial_auto_reply_text: string
  initial_auto_reply_sent_at: string | null
  real_reply_sent: boolean
  real_reply_text: string
  real_reply_sent_at: string | null
  real_reply_user_name: string
  sla_minutes_to_real_reply: number
  raw_data?: any
  created: string
  updated: string
}

export interface MLQuestionsConfig {
  id: string
  auto_reply_enabled: boolean
  auto_reply_text: string
  polling_interval_seconds: number
  sla_warning_hours: number
  sla_critical_hours: number
  notes?: string
}

export interface MLQuestionTemplate {
  id: string
  title: string
  category: string
  keywords: string[]
  content: string
  use_stock_placeholder: boolean
  times_used: number
  active: boolean
  created?: string
  updated?: string
}

export interface MLQuestionInsightProduct {
  item_id: string
  item_title: string
  item_permalink: string
  total_questions: number
  pending_questions: number
  sample_texts: string[]
  is_corrected?: boolean
  last_correction?: {
    id: string
    item_id: string
    applied_at: string
    applied_by: string
    proposed_text: string
  } | null
}

export interface MLQuestionMetrics {
  pending_total: number
  pending_unanswered: number
  waiting_real_reply: number
  critical_count: number
  warning_count: number
  answered_count: number
  answered_today: number
  avg_sla_minutes: number
  top_products_with_questions: MLQuestionInsightProduct[]
  recent_corrections?: {
    id: string
    item_id: string
    item_title: string
    item_permalink: string
    applied_at: string
    applied_by: string
    proposed_text: string
  }[]
}

export interface MLInsightCorrectionProposal {
  ok: boolean
  item_id: string
  item_title: string
  item_permalink: string
  ml_item_status: string
  matching_stock: number
  total_questions: number
  sample_questions: string[]
  proposed_text: string
  current_description: string
  final_description_preview: string
  already_corrected: boolean
  last_correction?: {
    applied_at: string
    applied_by: string
    proposed_text: string
  } | null
  error?: string
}

export interface ApplyMLInsightCorrectionInput {
  item_id: string
  proposed_text: string
}

export interface ApplyMLInsightCorrectionResponse {
  ok: boolean
  message: string
  item_id: string
  item_title: string
  item_permalink: string
  applied_by: string
  applied_at: string
  final_description: string
  audit_id?: string
  error?: string
}

export interface SyncQuestionsResult {
  ok: boolean
  total_unanswered_in_ml: number
  saved_count: number
  auto_replied_count: number
  auto_reply_enabled: boolean
  error?: string
}

export interface AnswerQuestionInput {
  question_id: string
  text: string
  save_as_template?: boolean
  template_title?: string
  template_category?: string
}

export interface AnswerQuestionResponse {
  ok: boolean
  question_id: string
  answer_text: string
  sla_minutes: number
  responder: string
  message: string
  error?: string
}

export const mlQuestionsService = {
  /**
   * Obtém a configuração da Central de Perguntas
   */
  async getConfig(): Promise<MLQuestionsConfig | null> {
    try {
      const records = await pb.collection('ml_questions_config').getList<MLQuestionsConfig>(1, 1, {
        sort: '-created',
        requestKey: null,
      })
      if (records.items.length > 0) {
        return records.items[0]
      }
      return null
    } catch (err) {
      console.error('Erro ao buscar ml_questions_config:', err)
      return null
    }
  },

  /**
   * Atualiza a configuração (ex: ligar/desligar auto-resposta e alterar mensagem)
   */
  async updateConfig(id: string, updates: Partial<MLQuestionsConfig>): Promise<MLQuestionsConfig> {
    return await pb.collection('ml_questions_config').update<MLQuestionsConfig>(id, updates)
  },

  /**
   * Sincroniza perguntas diretamente via hook backend (e dispara auto-resposta caso ligada)
   */
  async syncQuestions(): Promise<SyncQuestionsResult> {
    const res = await pb.send<SyncQuestionsResult>('/backend/v1/ml/questions/sync', {
      method: 'POST',
      body: {},
    })
    return res
  },

  /**
   * Lista perguntas do cache local com filtros avançados e ordenação por data de criação
   */
  async listQuestions(options?: {
    filterStatus?: 'all' | 'unanswered' | 'auto_replied' | 'answered'
    search?: string
    page?: number
    perPage?: number
  }): Promise<{ items: MLQuestionRecord[]; totalItems: number }> {
    const page = options?.page || 1
    const perPage = options?.perPage || 100

    const filters: string[] = []

    if (options?.filterStatus && options.filterStatus !== 'all') {
      filters.push(`queue_status = "${options.filterStatus}"`)
    }

    if (options?.search?.trim()) {
      const q = options.search.trim().replace(/["\\]/g, '')
      filters.push(
        `(text ~ "${q}" || item_title ~ "${q}" || buyer_nickname ~ "${q}" || item_id ~ "${q}" || question_id ~ "${q}")`,
      )
    }

    const filterStr = filters.join(' && ')

    try {
      const res = await pb
        .collection('ml_questions_cache')
        .getList<MLQuestionRecord>(page, perPage, {
          // Fallback robusto de ordenação
          sort: '-date_created,-created',
          filter: filterStr || undefined,
          requestKey: null,
        })
      return {
        items: res.items,
        totalItems: res.totalItems,
      }
    } catch (err) {
      console.error('Erro ao listar ml_questions_cache:', err)
      return { items: [], totalItems: 0 }
    }
  },

  /**
   * Envia resposta definitiva via hook backend para o Mercado Livre
   */
  async answerQuestion(input: AnswerQuestionInput): Promise<AnswerQuestionResponse> {
    const res = await pb.send<AnswerQuestionResponse>('/backend/v1/ml/questions/answer', {
      method: 'POST',
      body: input,
    })
    return res
  },

  /**
   * Busca métricas de SLA e insights consolidados
   */
  async getMetrics(): Promise<MLQuestionMetrics> {
    try {
      const res = await pb.send<MLQuestionMetrics>('/backend/v1/ml/questions/metrics', {
        method: 'GET',
      })
      return res
    } catch (err) {
      console.error('Erro ao buscar métricas de perguntas:', err)
      return {
        pending_total: 0,
        pending_unanswered: 0,
        waiting_real_reply: 0,
        critical_count: 0,
        warning_count: 0,
        answered_count: 0,
        answered_today: 0,
        avg_sla_minutes: 0,
        top_products_with_questions: [],
      }
    }
  },

  /**
   * Lista todos os templates ativos de resposta inteligente
   */
  async getTemplates(): Promise<MLQuestionTemplate[]> {
    try {
      const res = await pb.collection('ml_question_templates').getList<MLQuestionTemplate>(1, 100, {
        filter: 'active = true',
        sort: '-times_used,-created',
        requestKey: null,
      })
      return res.items
    } catch (err) {
      console.error('Erro ao listar templates:', err)
      return []
    }
  },

  /**
   * Cria novo template de resposta
   */
  async createTemplate(
    template: Omit<MLQuestionTemplate, 'id' | 'times_used' | 'created' | 'updated'>,
  ): Promise<MLQuestionTemplate> {
    return await pb.collection('ml_question_templates').create<MLQuestionTemplate>({
      ...template,
      times_used: 0,
      active: true,
    })
  },

  /**
   * Atualiza template existente
   */
  async updateTemplate(
    id: string,
    updates: Partial<MLQuestionTemplate>,
  ): Promise<MLQuestionTemplate> {
    return await pb.collection('ml_question_templates').update<MLQuestionTemplate>(id, updates)
  },

  /**
   * Exclui ou inativa template
   */
  async deleteTemplate(id: string): Promise<boolean> {
    try {
      await pb.collection('ml_question_templates').delete(id)
      return true
    } catch (err) {
      console.error('Erro ao deletar template:', err)
      return false
    }
  },

  /**
   * Incrementa uso de um template
   */
  async incrementTemplateUsage(id: string, currentUsage = 0): Promise<void> {
    try {
      await pb.collection('ml_question_templates').update(id, {
        times_used: currentUsage + 1,
      })
    } catch {
      /* intentionally ignored */
    }
  },

  /**
   * Gera a proposta de correção inteligente para a descrição do anúncio com preview lado a lado
   */
  async getInsightCorrectionProposal(itemId: string): Promise<MLInsightCorrectionProposal> {
    const res = await pb.send<MLInsightCorrectionProposal>(
      `/backend/v1/ml/questions/insight-correction/propose?item_id=${encodeURIComponent(itemId)}`,
      {
        method: 'GET',
      },
    )
    return res
  },

  /**
   * Aplica a correção de 1 clique na descrição do anúncio no Mercado Livre (PUT /items/{id}/description)
   */
  async applyInsightCorrection(
    input: ApplyMLInsightCorrectionInput,
  ): Promise<ApplyMLInsightCorrectionResponse> {
    const res = await pb.send<ApplyMLInsightCorrectionResponse>(
      '/backend/v1/ml/questions/insight-correction/apply',
      {
        method: 'POST',
        body: input,
      },
    )
    return res
  },

  /**
   * Lista auditoria de correções de insights realizadas
   */
  async listCorrections(limit = 20) {
    try {
      const records = await pb.collection('ml_question_corrections').getList(1, limit, {
        sort: '-applied_at,-created',
        requestKey: null,
      })
      return records.items
    } catch (err) {
      console.error('Erro ao listar correções de anúncios:', err)
      return []
    }
  },
}
