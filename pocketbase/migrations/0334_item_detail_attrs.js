migrate(
  (app) => {
    // 0334_item_detail_attrs.js
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (!sRecords || sRecords.length === 0) return
    const token = sRecords[0].getString('access_token')

    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7566367408',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      timeout: 10,
    })

    const it = itemRes.json || {}
    const attrs = (it.attributes || []).map((a) => a.id + ': ' + a.value_id + ' = ' + a.value_name)

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const diag = new Record(col)
    diag.set('status', 'done')
    diag.set('status_filter', '__PERICIA_0334__')
    diag.set('progress_text', 'Attrs count: ' + attrs.length)
    diag.set(
      'error_message',
      JSON.stringify({
        id: it.id,
        condition: it.condition,
        catalog_product_id: it.catalog_product_id,
        catalog_listing: it.catalog_listing,
        sub_status: it.sub_status,
        deal_ids: it.deal_ids,
        variations: it.variations,
        attrs: attrs,
      }).substring(0, 4900),
    )
    app.save(diag)
  },
  (app) => {},
)
