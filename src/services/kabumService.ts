import pb from '@/lib/pocketbase/client'
import type { KabumSettings, KabumTestResult, KabumSyncJob } from '@/types/kabum'

export const DEFAULT_KABUM_URLS = {
  production: 'https://kabum.mirakl.net',
  homologation: 'https://kabum-dev.mirakl.net',
}

export const kabumService = {
  /**
   * Obtém a configuração salva do Kabum
   */
  async getSettings(): Promise<KabumSettings | null> {
    try {
      const records = await pb.collection('kabum_settings').getList<KabumSettings>(1, 1, {
        sort: '-created',
      })
      if (records.items && records.items.length > 0) {
        return records.items[0]
      }
      return null
    } catch (err) {
      console.warn('[kabumService] Falha ao carregar configurações:', err)
      return null
    }
  },

  /**
   * Salva ou atualiza as configurações do Kabum
   */
  async saveSettings(settings: Partial<KabumSettings>): Promise<KabumSettings> {
    const existing = await this.getSettings()
    if (existing?.id) {
      return await pb.collection('kabum_settings').update<KabumSettings>(existing.id, settings)
    } else {
      return await pb.collection('kabum_settings').create<KabumSettings>({
        environment: 'production',
        api_url: DEFAULT_KABUM_URLS.production,
        ...settings,
      })
    }
  },

  /**
   * Testa a credencial através do endpoint de backend (que chama o Mirakl ST11 / S01 / A01)
   */
  async testConnection(customConfig?: {
    apiKey?: string
    apiUrl?: string
    environment?: 'production' | 'homologation'
  }): Promise<KabumTestResult> {
    try {
      const resp = await pb.send<KabumTestResult>('/backend/v1/kabum/test-connection', {
        method: 'POST',
        body: customConfig || {},
      })
      return resp
    } catch (err: any) {
      return {
        ok: false,
        message:
          err?.response?.message || err?.message || 'Erro ao conectar à API do Kabum/Mirakl.',
      }
    }
  },

  /**
   * Retorna os últimos jobs de sincronização ou fila
   */
  async getRecentJobs(limit = 10): Promise<KabumSyncJob[]> {
    try {
      const res = await pb.collection('kabum_sync_jobs').getList<KabumSyncJob>(1, limit, {
        sort: '-created',
      })
      return res.items
    } catch (err) {
      console.warn('[kabumService] Falha ao buscar jobs do Kabum:', err)
      return []
    }
  },

  /**
   * Enfileira produtos para publicação no Kabum
   */
  async enqueuePublishProducts(
    productIds: string[],
  ): Promise<{ ok: boolean; enqueuedCount: number; message: string }> {
    const settings = await this.getSettings()
    if (!settings?.api_key) {
      throw new Error('Configure a chave do Kabum em Configurações antes de publicar.')
    }

    try {
      let count = 0
      for (const prodId of productIds) {
        await pb.collection('kabum_sync_jobs').create({
          job_type: 'product_publish',
          status: 'pending',
          product_id: prodId,
          payload: { queuedAt: new Date().toISOString() },
        })
        count++
      }

      return {
        ok: true,
        enqueuedCount: count,
        message: `${count} produto(s) enfileirados para publicação no Kabum.`,
      }
    } catch (err: any) {
      throw new Error(err?.message || 'Falha ao enfileirar produtos para o Kabum.')
    }
  },

  /**
   * Dispara o worker de sincronização de preço e estoque (manual ou disparado pela UI)
   */
  async triggerPriceStockSync(): Promise<{ ok: boolean; message: string }> {
    const settings = await this.getSettings()
    if (!settings?.api_key) {
      return {
        ok: false,
        message: 'A integração está em modo dormente. Adicione a chave de API nas Configurações.',
      }
    }

    try {
      const res = await pb.send<{ ok: boolean; message: string }>(
        '/backend/v1/kabum/sync-prices-stock',
        {
          method: 'POST',
        },
      )
      return res
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message || 'Erro ao disparar worker de sincronização.',
      }
    }
  },
}
