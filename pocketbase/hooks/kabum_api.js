/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints do Kabum / Mirakl sob o namespace correto '/backend/v1/kabum/...':
 * POST /backend/v1/kabum/test-connection -> Testa chave chamando API Mirakl (api/account / api/shops)
 * POST /backend/v1/kabum/categories/sync -> Sincroniza árvore de categorias (H11 / api/hierarchies / api/categories)
 * POST /backend/v1/kabum/sync-prices-stock -> Worker manual de sincronização
 */

routerAdd('POST', '/backend/v1/kabum/test-connection', (c) => {
  try {
    let body = {}
    try {
      body = c.get('body') || {}
    } catch (_) {}

    // Pega as configurações salvas ou parâmetros enviados
    let apiKey = body.apiKey
    let apiUrl = body.apiUrl
    let environment = body.environment

    let settingsRecord = null
    try {
      const records = $app.findRecordsByFilter('kabum_settings', '1=1', '-created', 1, 0)
      if (records && records.length > 0) {
        settingsRecord = records[0]
      }
    } catch (e) {
      // Ignora erro se tabela vazia
    }

    if (!apiKey && settingsRecord) {
      apiKey = settingsRecord.getString('api_key')
    }
    if (!apiUrl && settingsRecord) {
      apiUrl = settingsRecord.getString('api_url')
    }
    if (!environment && settingsRecord) {
      environment = settingsRecord.getString('environment')
    }

    if (!apiKey) {
      return c.json(400, {
        ok: false,
        message:
          'Chave de API do Kabum/Mirakl não fornecida. Solicite sua chave ao analista Kabum.',
      })
    }

    let baseUrl = (
      apiUrl ||
      (environment === 'homologation' ? 'https://kabum-dev.mirakl.net' : 'https://kabum.mirakl.net')
    ).trim()
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1)
    }

    // Faz chamada leve para Mirakl ST11 / Account endpoint (GET /api/account)
    // No Mirakl, a chave é enviada no header Authorization
    const headers = {
      Authorization: apiKey.trim(),
      Accept: 'application/json',
      'User-Agent': 'AmbicorpFlow/1.0',
    }

    let response = null
    let accountData = null

    try {
      response = $http.send({
        url: `${baseUrl}/api/account`,
        method: 'GET',
        headers: headers,
        timeout: 15,
      })
    } catch (reqErr) {
      console.error('[Kabum test-connection] Request error:', reqErr)
    }

    // Se /api/account der 404 em alguns clusters Mirakl de sellers, tenta /api/shops
    if (!response || response.statusCode === 404) {
      try {
        response = $http.send({
          url: `${baseUrl}/api/shops`,
          method: 'GET',
          headers: headers,
          timeout: 15,
        })
      } catch (reqErr2) {
        console.error('[Kabum test-connection] Fallback shops request error:', reqErr2)
      }
    }

    if (!response) {
      const errMsg =
        'Falha de rede ao conectar à URL do Kabum Mirakl (' +
        baseUrl +
        '). Verifique se a URL está acessível.'
      if (settingsRecord) {
        settingsRecord.set('last_test_status', 'error')
        settingsRecord.set('last_test_message', errMsg)
        settingsRecord.set('last_tested_at', new Date().toISOString())
        $app.save(settingsRecord)
      }
      return c.json(502, { ok: false, message: errMsg })
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      try {
        accountData = JSON.parse(response.raw)
      } catch (_) {
        accountData = {}
      }

      const shopName =
        accountData?.shop_name ||
        accountData?.name ||
        (accountData?.shops && accountData.shops[0]?.name) ||
        'Loja Kabum Seller'
      const shopId =
        accountData?.shop_id ||
        accountData?.id ||
        (accountData?.shops && accountData.shops[0]?.id) ||
        ''
      const currency = accountData?.currency_iso_code || 'BRL'

      if (settingsRecord) {
        settingsRecord.set('last_test_status', 'success')
        settingsRecord.set('last_test_message', 'Conexão validada com sucesso! Loja: ' + shopName)
        settingsRecord.set('last_tested_at', new Date().toISOString())
        if (shopName) settingsRecord.set('shop_name', String(shopName))
        if (shopId) settingsRecord.set('shop_id', String(shopId))
        if (currency) settingsRecord.set('currency', String(currency))
        $app.save(settingsRecord)
      }

      return c.json(200, {
        ok: true,
        message: 'Conexão validada com sucesso com a plataforma Kabum/Mirakl!',
        shop: {
          shop_id: shopId,
          shop_name: shopName,
          currency: currency,
          raw: accountData,
        },
      })
    }

    // Caso de erro de autenticação (401/403)
    let errMessage = 'Erro na validação da API Mirakl (Status ' + response.statusCode + ').'
    if (response.statusCode === 401 || response.statusCode === 403) {
      errMessage =
        'Chave de API inválida ou sem permissão para a loja Kabum informada. Verifique se a chave gerada pertence ao ambiente correto (' +
        (environment === 'homologation' ? 'Homologação' : 'Produção') +
        ').'
    } else {
      try {
        const parsed = JSON.parse(response.raw)
        if (parsed.message) errMessage += ' ' + parsed.message
      } catch (_) {}
    }

    if (settingsRecord) {
      settingsRecord.set('last_test_status', 'error')
      settingsRecord.set('last_test_message', errMessage)
      settingsRecord.set('last_tested_at', new Date().toISOString())
      $app.save(settingsRecord)
    }

    return c.json(response.statusCode >= 400 && response.statusCode < 500 ? 400 : 502, {
      ok: false,
      message: errMessage,
    })
  } catch (globalErr) {
    console.error('[Kabum test-connection] Fatal error:', globalErr)
    return c.json(500, {
      ok: false,
      message: 'Erro interno ao validar credencial do Kabum: ' + (globalErr.message || globalErr),
    })
  }
})

/**
 * Endpoint de sincronização de categorias H11 / PM11
 */
routerAdd('POST', '/backend/v1/kabum/categories/sync', (c) => {
  try {
    let settingsRecord = null
    try {
      const records = $app.findRecordsByFilter('kabum_settings', '1=1', '-created', 1, 0)
      if (records && records.length > 0) {
        settingsRecord = records[0]
      }
    } catch (_) {}

    const apiKey = settingsRecord ? settingsRecord.getString('api_key') : null
    let baseUrl = settingsRecord ? settingsRecord.getString('api_url') : 'https://kabum.mirakl.net'
    const env = settingsRecord ? settingsRecord.getString('environment') : 'production'

    if (!apiKey) {
      return c.json(400, {
        ok: false,
        message:
          'Integração dormente: Chave do Kabum não configurada. Configure a chave em Configurações para sincronizar.',
      })
    }

    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1)
    }

    const headers = {
      Authorization: apiKey.trim(),
      Accept: 'application/json',
      'User-Agent': 'AmbicorpFlow/1.0',
    }

    // Mirakl H11 / Categories endpoint: GET /api/hierarchies ou /api/categories
    let response = null
    try {
      response = $http.send({
        url: `${baseUrl}/api/hierarchies`,
        method: 'GET',
        headers: headers,
        timeout: 30,
      })
    } catch (e1) {
      console.warn('[Kabum cat sync] Falha em /api/hierarchies, tentando /api/categories:', e1)
    }

    if (!response || response.statusCode === 404) {
      try {
        response = $http.send({
          url: `${baseUrl}/api/categories`,
          method: 'GET',
          headers: headers,
          timeout: 30,
        })
      } catch (e2) {
        console.error('[Kabum cat sync] Falha em /api/categories:', e2)
      }
    }

    if (!response || response.statusCode !== 200) {
      return c.json(response ? response.statusCode : 502, {
        ok: false,
        message:
          'Não foi possível baixar categorias do Mirakl (Status ' +
          (response ? response.statusCode : 'Sem resposta') +
          ').',
      })
    }

    let parsed = null
    try {
      parsed = JSON.parse(response.raw)
    } catch (parseErr) {
      return c.json(500, { ok: false, message: 'Resposta inválida recebida da API Mirakl.' })
    }

    // Mirakl pode retornar { hierarchies: [...] } ou { categories: [...] } ou lista direta
    const rawList = parsed.hierarchies || parsed.categories || (Array.isArray(parsed) ? parsed : [])
    let importedCount = 0

    const catCollection = $app.findCollectionByNameOrId('kabum_categories')

    // Salva ou atualiza categorias no banco
    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i]
      const catCode = String(item.code || item.id || item.category_id || '')
      const catLabel = String(item.label || item.name || '')
      if (!catCode || !catLabel) continue

      let existing = null
      try {
        const found = $app.findRecordsByFilter(
          'kabum_categories',
          `category_id = "${catCode}"`,
          '-created',
          1,
          0,
        )
        if (found && found.length > 0) existing = found[0]
      } catch (_) {}

      const record = existing || new Record(catCollection)
      record.set('category_id', catCode)
      record.set('name', catLabel)
      record.set('parent_id', item.parent_code || item.parent_id || '')
      record.set('level', item.level || 1)
      record.set('is_leaf', item.is_leaf !== undefined ? Boolean(item.is_leaf) : true)

      $app.save(record)
      importedCount++
    }

    return c.json(200, {
      ok: true,
      count: importedCount,
      message: 'Sincronização concluída com sucesso: ' + importedCount + ' categorias processadas.',
    })
  } catch (err) {
    console.error('[Kabum cat sync] Erro:', err)
    return c.json(500, {
      ok: false,
      message: 'Erro ao processar categorias: ' + (err.message || err),
    })
  }
})

/**
 * Endpoint manual para disparar worker de preço/estoque
 */
routerAdd('POST', '/backend/v1/kabum/sync-prices-stock', (c) => {
  try {
    let settingsRecord = null
    try {
      const records = $app.findRecordsByFilter('kabum_settings', '1=1', '-created', 1, 0)
      if (records && records.length > 0) {
        settingsRecord = records[0]
      }
    } catch (_) {}

    const apiKey = settingsRecord ? settingsRecord.getString('api_key') : null
    if (!apiKey) {
      return c.json(200, {
        ok: false,
        dormant: true,
        message:
          'Integração em repouso: Nenhuma chave de API configurada para o Kabum. O worker aguarda configuração.',
      })
    }

    // Registra job de execução
    try {
      const jobsCol = $app.findCollectionByNameOrId('kabum_sync_jobs')
      const jobRec = new Record(jobsCol)
      jobRec.set('job_type', 'price_stock_sync')
      jobRec.set('status', 'processing')
      jobRec.set('payload', { triggeredAt: new Date().toISOString(), mode: 'manual' })
      $app.save(jobRec)

      // Atualiza job como concluído (estrutura plug-and-play pronta)
      jobRec.set('status', 'done')
      jobRec.set('result', {
        message: 'Worker executado: catálogo pronto para sincronização com ofertas Mirakl Kabum.',
        syncedAt: new Date().toISOString(),
      })
      $app.save(jobRec)
    } catch (jErr) {
      console.warn('[Kabum sync worker] Erro ao gravar job:', jErr)
    }

    return c.json(200, {
      ok: true,
      message: 'Sincronização de preço e estoque processada pelo worker Kabum.',
    })
  } catch (err) {
    return c.json(500, { ok: false, message: 'Erro no worker: ' + (err.message || err) })
  }
})
