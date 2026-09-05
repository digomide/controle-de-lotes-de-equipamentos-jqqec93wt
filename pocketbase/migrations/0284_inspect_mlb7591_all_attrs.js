migrate(
  (app) => {
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    let token = sRecords.length > 0 ? sRecords[0].getString('access_token') : ''

    // 1. Investigar atributos de MLB7591024470
    let itAttrs = []
    if (token) {
      try {
        const it = $http.send({
          url: 'https://api.mercadolibre.com/items/MLB7591024470',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        if (it.statusCode === 200) {
          itAttrs = (it.json.attributes || []).map((a) => a.id + '=' + a.value_name)
        }
      } catch (e) {}
    }

    // 2. Investigar MLB15392536 e filhos
    let prodInfo = null
    if (token) {
      try {
        const p = $http.send({
          url: 'https://api.mercadolibre.com/products/MLB15392536',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10,
        })
        prodInfo = {
          name: p.json.name,
          children: p.json.children_ids,
          status: p.json.status,
          domain_id: p.json.domain_id,
        }
      } catch (e) {}
    }

    const rec = app.findFirstRecordByFilter(
      'ml_ads_fetch_jobs',
      "status_filter = '__DIAG_INSPIRON_3576__'",
    )
    rec.set('progress_text', ('itAttrs: ' + itAttrs.slice(0, 10).join(', ')).substring(0, 250))
    rec.set('error_message', JSON.stringify({ itAttrs: itAttrs, prodInfo: prodInfo }))
    app.save(rec)
  },
  (app) => {},
)
