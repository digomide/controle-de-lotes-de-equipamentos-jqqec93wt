migrate(
  (app) => {
    // 0509_diagnose_mlb5195337721.js
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter(
        'ml_settings',
        'tenant_id = "ambicorpmestre1"',
        '-created',
        1,
        0,
      )
      if (sRecords && sRecords.length > 0) {
        settings = sRecords[0]
      }
    } catch (_) {}

    if (!settings) {
      console.log('[0509_diag] Settings não encontradas')
      return
    }

    const accessToken = settings.getString('access_token')
    const sellerId = settings.getString('user_id_ml')
    const targetItem = 'MLB5195337721'

    // 1. GET /items/MLB5195337721
    let getRes = null
    try {
      getRes = $http.send({
        url: 'https://api.mercadolibre.com/items/' + targetItem,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json',
        },
        timeout: 20,
      })
    } catch (e) {
      getRes = { error: String(e) }
    }

    // 2. Tentar PUT /items/MLB5195337721 com preço
    let putRes = null
    try {
      putRes = $http.send({
        url: 'https://api.mercadolibre.com/items/' + targetItem,
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ price: 3500 }),
        timeout: 20,
      })
    } catch (e) {
      putRes = { error: String(e) }
    }

    const col = app.findCollectionByNameOrId('ml_competitor_jobs')
    const job = new Record(col)
    job.set('action', 'search_query')
    job.set('status', 'done')
    job.set('query', 'diag_mlb5195337721')
    job.set('result_data', {
      targetItem: targetItem,
      sellerIdFromSettings: sellerId,
      get: {
        status: getRes ? getRes.statusCode : null,
        body: getRes ? getRes.json || getRes.raw : null,
      },
      put: {
        status: putRes ? putRes.statusCode : null,
        body: putRes ? putRes.json || putRes.raw : null,
      },
    })
    app.save(job)
  },
  (app) => {},
)
