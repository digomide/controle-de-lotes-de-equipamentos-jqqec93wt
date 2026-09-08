migrate(
  (app) => {
    // 1. Simular chamada com chave incorreta/ausente via app ou simulação de hook
    // Testamos a inserção e validação do fluxo nativo
    const col = app.findCollectionByNameOrId('ml_collector_imports')
    const rec = new Record(col)
    rec.set('search_term', 'validacao final ponta a ponta')
    rec.set('source_url', 'https://lista.mercadolivre.com.br/validacao-final')
    rec.set('imported_at', new Date().toISOString())
    rec.set('payload', {
      version: '1.2.0',
      results: [
        {
          id: 'MLB1010101010',
          title: 'Item de Teste Validação Final',
          price: 99.9,
          sold_quantity: 12,
        },
      ],
    })
    rec.set('results_count', 1)
    rec.set('with_sales_count', 1)
    rec.set('notes', 'validacao_final_temp')

    app.save(rec)

    console.log('[migration 0419] Inserção direta confirmada id=' + rec.id)
    app.delete(rec)
    console.log('[migration 0419] Registro temporário deletado com sucesso!')
  },
  (app) => {},
)
