// Migração de investigação: salva o relatório completo em uma tabela existente
// Usa a collection ml_item_queue para registrar o diagnóstico completo

migrate(
  (app) => {
    const targetIds = ['MLB7566367408', 'MLB7566510008', 'MLB5193740831']

    let settings = null
    try {
      const sList = app.findRecordsByFilter(
        'ml_settings',
        'tenant_id="ambicorpmestre1" || tenant_id="ambicorp"',
        '-created',
        1,
        0,
      )
      if (sList && sList.length > 0) settings = sList[0]
    } catch (_) {}

    if (!settings) {
      const fallback = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (fallback && fallback.length > 0) settings = fallback[0]
    }

    if (!settings) return

    const token = settings.getString('access_token')
    const userId = settings.getString('user_id_ml') || '626774396'

    const report = {
      user_id: userId,
      user_promotions: {},
      items: {},
    }

    // 1. Endpoints de promoções no usuário
    const userPromoEndpoints = [
      {
        key: 'seller_promotions_user',
        url: 'https://api.mercadolibre.com/seller-promotions/users/' + userId + '?app_version=v2',
      },
      {
        key: 'users_promotions',
        url: 'https://api.mercadolibre.com/users/' + userId + '/promotions',
      },
      {
        key: 'seller_promotions_started',
        url: 'https://api.mercadolibre.com/seller-promotions/promotions?status=started&app_version=v2',
      },
      {
        key: 'seller_promotions_candidate',
        url: 'https://api.mercadolibre.com/seller-promotions/promotions?status=candidate&app_version=v2',
      },
    ]

    for (let i = 0; i < userPromoEndpoints.length; i++) {
      const ep = userPromoEndpoints[i]
      try {
        const res = $http.send({
          url: ep.url,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
          },
          timeout: 15,
        })
        report.user_promotions[ep.key] = {
          status: res.statusCode,
          body: res.json || res.raw,
        }
      } catch (e) {
        report.user_promotions[ep.key] = { error: String(e) }
      }
    }

    // 2. Para cada anúncio
    for (let t = 0; t < targetIds.length; t++) {
      const mlbId = targetIds[t]
      const itemData = {}

      // 2.1 GET /items/{id}
      try {
        const itemRes = $http.send({
          url: 'https://api.mercadolibre.com/items/' + mlbId,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 15,
        })
        if (itemRes.statusCode === 200 && itemRes.json) {
          const d = itemRes.json
          itemData.item_summary = {
            title: d.title,
            price: d.price,
            original_price: d.original_price,
            deal_ids: d.deal_ids,
            tags: d.tags,
            catalog_listing: d.catalog_listing,
            catalog_product_id: d.catalog_product_id,
            sub_status: d.sub_status,
            status: d.status,
          }
        } else {
          itemData.item_summary = { status: itemRes.statusCode, raw: itemRes.raw }
        }
      } catch (e) {
        itemData.item_summary = { error: String(e) }
      }

      // 2.2 GET /seller-promotions/items/{id} e variações
      const promoEndpoints = [
        {
          key: 'seller_promotions_item',
          url: 'https://api.mercadolibre.com/seller-promotions/items/' + mlbId + '?app_version=v2',
        },
        {
          key: 'items_promotions',
          url: 'https://api.mercadolibre.com/items/' + mlbId + '/promotions',
        },
        { key: 'items_prices', url: 'https://api.mercadolibre.com/items/' + mlbId + '/prices' },
      ]

      itemData.promotions = {}
      for (let p = 0; p < promoEndpoints.length; p++) {
        const pe = promoEndpoints[p]
        try {
          const prRes = $http.send({
            url: pe.url,
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + token,
              Accept: 'application/json',
            },
            timeout: 15,
          })
          itemData.promotions[pe.key] = {
            status: prRes.statusCode,
            body: prRes.json || prRes.raw,
          }
        } catch (e) {
          itemData.promotions[pe.key] = { error: String(e) }
        }
      }

      // 2.3 PUT /items/{id} com price: 2199 para capturar o payload completo exato e headers
      try {
        const putRes = $http.send({
          url: 'https://api.mercadolibre.com/items/' + mlbId,
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ price: 2199 }),
          timeout: 15,
        })
        itemData.put_test = {
          status: putRes.statusCode,
          headers: putRes.headers,
          body: putRes.json || putRes.raw,
        }
      } catch (e) {
        itemData.put_test = { error: String(e) }
      }

      report.items[mlbId] = itemData
    }

    // Gravar resultado em um registro de teste na collection ml_item_queue para leitura
    const qCol = app.findCollectionByNameOrId('ml_item_queue')
    const qRecord = new Record(qCol)
    qRecord.set('ml_item_id', 'DIAGNOSTIC_PROMO_403')
    qRecord.set('action', 'update_price')
    qRecord.set('status', 'done')
    qRecord.set('error_message', 'Diagnóstico concluído')
    qRecord.set('result', report)
    app.save(qRecord)
  },
  (app) => {
    // no-op revert
  },
)
