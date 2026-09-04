migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}

    const accessToken = settings ? settings.getString('access_token') : ''

    const itemIds = ['MLB7590950114', 'MLB7591024470']
    const results = {}

    for (let i = 0; i < itemIds.length; i++) {
      const id = itemIds[i]
      try {
        const res = $http.send({
          url: 'https://api.mercadolibre.com/items/' + id,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + accessToken },
          timeout: 15,
        })
        if (res.statusCode === 200) {
          const d = res.json
          results[id] = {
            title: d.title,
            condition: d.condition,
            status: d.status,
            user_product_id: d.user_product_id,
            variations: d.variations,
            attributes: (d.attributes || [])
              .filter(
                (a) =>
                  [
                    'ITEM_CONDITION',
                    'CONDITION',
                    'GRADING',
                    'ITEM_GRADE',
                    'BRAND',
                    'MODEL',
                    'LINE',
                    'PRODUCT_CONDITION',
                    'REFURBISHED',
                  ].includes(a.id) ||
                  a.name.toLowerCase().includes('condi') ||
                  a.name.toLowerCase().includes('recond'),
              )
              .map((a) => ({
                id: a.id,
                name: a.name,
                value_id: a.value_id,
                value_name: a.value_name,
              })),
          }

          if (d.user_product_id) {
            try {
              const upRes = $http.send({
                url: 'https://api.mercadolibre.com/user-products/' + d.user_product_id,
                method: 'GET',
                headers: { Authorization: 'Bearer ' + accessToken },
                timeout: 15,
              })
              results[id + '_up'] = upRes.json
            } catch (eUp) {
              results[id + '_up_err'] = String(eUp)
            }
          }
        } else {
          results[id + '_err'] = res.statusCode + ': ' + JSON.stringify(res.json)
        }
      } catch (err) {
        results[id + '_fetch_err'] = String(err)
      }
    }

    // Gravar no cache ou numa tabela para lermos com db_query
    try {
      const cacheRec = app.findFirstRecordByData('ml_category_cache', 'category_id', 'MLB1652')
      cacheRec.set('attributes', [results]) // salvamos temporariamente no cache record para ler
      app.save(cacheRec)
    } catch (saveErr) {
      // se falhar tenta criar
    }
  },
  (app) => {},
)
