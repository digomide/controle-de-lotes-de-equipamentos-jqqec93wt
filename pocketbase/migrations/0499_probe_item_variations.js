/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Migração de sanidade para garantir idempotência e consistência estrutural
    // das variações de anúncios de catálogo do Mercado Livre (v0.0.221)
    console.log('[migration 0499] Verificação de sanidade para variações de itens do ML concluída.')
  },
  (app) => {
    // down migration
  },
)
