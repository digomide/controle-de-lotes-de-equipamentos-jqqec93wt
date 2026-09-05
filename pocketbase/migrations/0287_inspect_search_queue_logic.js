migrate(
  (app) => {
    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    // 1. Simular o que a Etapa 2 de busca paginada fez quando buscou por 'dell inspiron 3576'
    // com condition = 'refurbished'
    // No hook ml_catalog_search_queue.js:
    // if (conditionKeyword && !queryHasCondWord) {
    //   const targetedQuery = queryRaw + ' ' + conditionKeyword  --> 'dell inspiron 3576 recondicionado'
    //   GET /products/search?status=active&site_id=MLB&q=dell%20inspiron%203576%20recondicionado
    let targetedRes = null
    let normalRes = null
    if (token) {
      try {
        const rTarget = $http.send({
          url:
            'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
            encodeURIComponent('dell inspiron 3576 recondicionado') +
            '&limit=10',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        targetedRes = {
          status: rTarget.statusCode,
          total: rTarget.json && rTarget.json.paging ? rTarget.json.paging.total : 0,
          results: (rTarget.json && rTarget.json.results ? rTarget.json.results : []).map((r) => ({
            id: r.id,
            name: r.name,
          })),
        }
      } catch (e) {
        targetedRes = { error: String(e) }
      }

      try {
        const rNorm = $http.send({
          url:
            'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=' +
            encodeURIComponent('dell inspiron 3576') +
            '&limit=10',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        normalRes = {
          status: rNorm.statusCode,
          total: rNorm.json && rNorm.json.paging ? rNorm.json.paging.total : 0,
          results: (rNorm.json && rNorm.json.results ? rNorm.json.results : []).map((r) => ({
            id: r.id,
            name: r.name,
            buybox: r.buy_box_winner,
          })),
        }
      } catch (e) {
        normalRes = { error: String(e) }
      }
    }

    rec.set(
      'progress_text',
      'targeted: ' +
        targetedRes.total +
        ' | normal: ' +
        normalRes.total +
        ' (sample: ' +
        (normalRes.results || []).map((r) => r.id).join(', ') +
        ')',
    )
    rec.set('error_message', JSON.stringify({ targeted: targetedRes, normal: normalRes }))
    app.save(rec)
  },
  (app) => {},
)
