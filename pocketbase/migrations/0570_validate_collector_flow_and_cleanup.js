/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Teste real de criação simulando a requisição HTTP com dados de teste
    // 1. Encontrar usuário membro (não admin) para validar
    const member = app.findFirstRecordByFilter('users', 'role = "member"')
    if (!member) {
      throw new Error('Usuário membro não encontrado para teste')
    }

    // 2. Criar registro em ml_collector_imports simulando payload do coletor de "fone de ouvido para capacete tomate"
    const importsCol = app.findCollectionByNameOrId('ml_collector_imports')
    const testRec = new Record(importsCol)
    testRec.set('search_term', 'fone de ouvido para capacete tomate')
    testRec.set(
      'source_url',
      'https://lista.mercadolivre.com.br/fone-de-ouvido-para-capacete-tomate',
    )
    testRec.set('imported_at', new Date().toISOString())
    testRec.set('results_count', 2)
    testRec.set('with_sales_count', 2)
    testRec.set('notes', 'teste_validacao_real_0570')
    testRec.set('payload', {
      search_term: 'fone de ouvido para capacete tomate',
      results: [
        {
          id: 'MLB9001002001',
          mlb_id: 'MLB9001002001',
          title: 'Fone De Ouvido Bluetooth Para Capacete Tomate Mt-101',
          price: 129.9,
          sold_quantity: 42,
          permalink: 'https://produto.mercadolivre.com.br/MLB-9001002001',
          thumbnail: 'https://http2.mlstatic.com/D_9001002001-O.jpg',
          seller_name: 'VENDEDOR_TESTE',
          condition: 'new',
        },
        {
          id: 'MLB9001002002',
          mlb_id: 'MLB9001002002',
          title: 'Intercomunicador Moto Capacete Tomate Bluetooth Sem Fio',
          price: 189.0,
          sold_quantity: 18,
          permalink: 'https://produto.mercadolivre.com.br/MLB-9001002002',
          thumbnail: 'https://http2.mlstatic.com/D_9001002002-O.jpg',
          seller_name: 'VENDEDOR_TESTE_2',
          condition: 'new',
        },
      ],
    })

    // Salvar sem especificar tenant_id
    app.save(testRec)

    // Validar se o tenant_id foi preenchido
    const savedTenantId = testRec.getString('tenant_id')
    if (savedTenantId !== 'ambicorpmestre1') {
      throw new Error(`tenant_id esperado 'ambicorpmestre1', obtido: '${savedTenantId}'`)
    }

    // Validar busca por filtro simulando o getLatestImportForTerm e getCollectorAdsForTerm
    const foundRecords = app.findRecordsByFilter(
      'ml_collector_imports',
      'search_term ~ "fone" && search_term ~ "capacete" && search_term ~ "tomate"',
      '-imported_at',
      5,
      0,
    )

    if (!foundRecords || foundRecords.length === 0) {
      throw new Error('Falha na consulta por filtro de busca do Raio-X!')
    }

    console.log(
      '[test 0570] Validação concluída com sucesso! Registro criado e lido com êxito. ID: ' +
        testRec.id,
    )

    // Deletar o registro de teste para manter a base do usuário 100% limpa
    app.delete(testRec)
    console.log('[test 0570] Registro de teste devidamente removido.')
  },
  (app) => {},
)
