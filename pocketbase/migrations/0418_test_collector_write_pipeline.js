migrate(
  (app) => {
    // 1. Localizar chave ativa para teste
    const keyRecords = app.findRecordsByFilter(
      'ml_collector_keys',
      "key = 'mlk_83xhpd68mtrmf9b4cztv' && active = true",
      '',
      1,
      0,
    )

    if (!keyRecords || keyRecords.length === 0) {
      console.log('[migration 0418] Chave de teste não encontrada em ml_collector_keys')
      return
    }

    const testKey = keyRecords[0]
    console.log('[migration 0418] Chave de teste encontrada: ' + testKey.getString('key'))

    // 2. Simular criação de importação
    const col = app.findCollectionByNameOrId('ml_collector_imports')
    const testRecord = new Record(col)
    testRecord.set('search_term', 'teste verificacao pipeline')
    testRecord.set('source_url', 'https://lista.mercadolivre.com.br/teste-pipeline')
    testRecord.set('imported_at', new Date().toISOString())
    testRecord.set('payload', {
      version: '1.1.0',
      results_count: 1,
      with_sales_count: 1,
      results: [
        {
          id: 'MLB9999999999',
          title: 'Produto Teste Pipeline Verificado',
          price: 150,
          sold_quantity: 5,
        },
      ],
    })
    testRecord.set('results_count', 1)
    testRecord.set('with_sales_count', 1)
    testRecord.set('notes', 'teste_pipeline_temporario')

    app.save(testRecord)
    console.log('[migration 0418] Registro de teste criado com sucesso id: ' + testRecord.id)

    // Atualizar last_used_at da chave
    testKey.set('last_used_at', new Date().toISOString())
    app.save(testKey)
    console.log('[migration 0418] last_used_at da chave atualizado!')

    // 3. Remover o registro de teste criado para manter o banco limpo
    app.delete(testRecord)
    console.log('[migration 0418] Registro de teste excluído, banco limpo e gravação confirmada!')
  },
  (app) => {
    // down migration
  },
)
