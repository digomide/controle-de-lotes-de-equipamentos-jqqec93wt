migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const catId = 'MLB2097858038'
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' }

    // 1. GET /products/MLB2097858038
    const pRes = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catId,
      method: 'GET',
      headers: headers,
      timeout: 10,
    })
    const pJson = pRes.json || {}

    // 2. GET /products/MLB2097858038/items
    const itRes = $http.send({
      url: 'https://api.mercadolibre.com/products/' + catId + '/items',
      method: 'GET',
      headers: headers,
      timeout: 10,
    })
    const itList = itRes.json
      ? Array.isArray(itRes.json)
        ? itRes.json
        : itRes.json.results || []
      : []

    // 3. Buscar detalhes de cada item retornado por /products/{catId}/items via GET /items/{id}
    const itemDetails = []
    let totalSoldFromItemDetails = 0
    for (let i = 0; i < itList.length && i < 10; i++) {
      const itId = itList[i].id || itList[i].item_id
      if (!itId) continue
      try {
        const iRes = $http.send({
          url: 'https://api.mercadolibre.com/items/' + itId,
          method: 'GET',
          headers: headers,
          timeout: 6,
        })
        if (iRes.statusCode === 200 && iRes.json) {
          const ij = iRes.json
          const s = ij.sold_quantity != null ? Number(ij.sold_quantity) : null
          if (s != null) totalSoldFromItemDetails += s
          itemDetails.push({
            id: itId,
            sold_quantity: s,
            initial_quantity: ij.initial_quantity,
            available_quantity: ij.available_quantity,
            title: (ij.title || '').substring(0, 40),
            catalog_product_id: ij.catalog_product_id,
            catalog_listing: ij.catalog_listing,
          })
        }
      } catch (e) {
        itemDetails.push({ id: itId, err: String(e) })
      }
    }

    // 4. Buscar busca pública no site ou api /sites/MLB/search?q=dell+latitude+5420+recondicionado
    const searchRes = $http.send({
      url: 'https://api.mercadolibre.com/sites/MLB/search?q=dell%20latitude%205420%20recondicionado&limit=10',
      method: 'GET',
      headers: headers,
      timeout: 8,
    })
    const sResults = (searchRes.json && searchRes.json.results) || []
    const matchingInSearch = []
    for (let j = 0; j < sResults.length; j++) {
      const it = sResults[j]
      if (
        it.catalog_product_id === catId ||
        (it.title && it.title.toLowerCase().includes('5420'))
      ) {
        matchingInSearch.push({
          id: it.id,
          title: (it.title || '').substring(0, 40),
          catalog_product_id: it.catalog_product_id,
          sold_quantity: it.sold_quantity,
        })
      }
    }

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const diag = {
      pJson_sold: pJson.sold_quantity,
      pJson_parent: pJson.parent_id,
      pJson_children: pJson.children_ids,
      itList_raw: itList,
      itemDetails: itemDetails,
      totalSoldFromItemDetails: totalSoldFromItemDetails,
      matchingInSearch: matchingInSearch,
    }

    job.set('error_message', JSON.stringify(diag).substring(0, 3500))
    job.set(
      'seller_nickname',
      (
        'totSoldDetails=' +
        totalSoldFromItemDetails +
        ' | itemsCnt=' +
        itList.length +
        ' | searchMatches=' +
        matchingInSearch.length
      ).substring(0, 250),
    )
    app.save(job)
  },
  (app) => {},
)
