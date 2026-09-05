migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    // 1. Investigar as posições encontradas para 'dell inspiron 3576'
    // 2. Por que o usuário considerou aquele anúncio uma "página de catálogo"?
    // Veja o prompt da tarefa:
    // "Contexto: sistema de controle de lotes/vendas de notebooks recondicionados (conta Mercado Livre INFOPRECOBAIXO). Na tela /anuncios-ml, aba "Anúncios de Catálogo" (busca profunda de posições de catálogo), a v0.0.91 adicionou mineração da própria conta do vendedor: os 564 anúncios sincronizados (coleção ml_ads_fetch_jobs, último job concluído) que casam com os termos da busca viram posições de catálogo exibidas no topo com badge "Sua posição".
    // PROBLEMA relatado pelo usuário (palavras dele): "mais um anúncio nosso recondicionado e não é encontrado no catálogo, resolve isso parceiro, tem que ter uma solução". Ele mostrou um anúncio DELE ativo no ML: "Dell Inspiron Inspiron 15-3576 (Recondicionado)", R$ 2.350, vendido por INFOPRECOBAIXO (+1000 vendas), página de catálogo com "Status do recondicionado: Excelente", bullet "Este é um produto recondicionado Excelente", "Última em estoque!". Esse anúncio NÃO aparece na busca de catálogo do nosso sistema (nem buscando "dell inspiron 3576", nem com o seletor de condição em "Recondicionado") — embora a v0.0.91 tenha corrigido o caso análogo do Dell Latitude 5420 (MLB2097858038 / anúncio MLB7566367408), que hoje aparece corretamente no topo com badge "Sua posição"."
    // "Correção esperada: QUALQUER anúncio próprio com posição de catálogo que case com a busca (busca textual e/ou condição selecionada: novo/usado/recondicionado) deve aparecer no topo do resultado com o badge "Sua posição", condição e GRADING corretos — sem depender de formato de título. Normalizar tokens (hífen, caixa, acentos, "15-3576" ↔ "3576") no casamento. Validar com TESTE REAL no backend: simular a busca "dell inspiron 3576" com condição recondicionado e confirmar que a posição do Inspiron aparece; e re-confirmar que o Latitude 5420 continua aparecendo. Não quebrar o fluxo existente (busca profunda, filtro rigoroso, publicação em massa). Após implementar, rodar QA e build."

    rec.set('progress_text', 'DIAGNOSIS_DONE')
    app.save(rec)
  },
  (app) => {},
)
