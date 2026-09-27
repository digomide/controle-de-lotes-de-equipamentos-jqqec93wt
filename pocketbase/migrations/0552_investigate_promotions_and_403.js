// Migração de investigação técnica sobre promoções/deals e body completo do 403 do ML
// Testa: MLB7566367408, MLB7566510008, MLB5193740831

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
      console.log('[0552_investigate] Sem ml_settings')
      return
    }

    const token = settings.getString('access_token')
    const userId = settings.getString('user_id_ml') || '626774396'

    console.log('[0552_investigate] Iniciando pericia técnica para user: ' + userId)

    // 1. Testar seller-promotions no nível do usuário
    const userPromoEndpoints = [
      'https://api.mercadolibre.com/seller-promotions/users/' + userId + '?app_version=v2',
      'https://api.mercadolibre.com/users/' + userId + '/promotions',
      'https://api.mercadolibre.com/seller-promotions/promotions?status=started&app_version=v2',
      'https://api.mercadolibre.com/seller-promotions/promotions?status=candidate&app_version=v2',
    ]

    for (let i = 0; i < userPromoEndpoints.length; i++) {
      const u = userPromoEndpoints[i]
      try {
        const res = $http.send({
          url: u,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
          },
          timeout: 15,
        })
        console.log(
          '[0552_investigate] URL: ' +
            u +
            ' -> HTTP ' +
            res.statusCode +
            ' | ' +
            (res.raw ? res.raw.substring(0, 300) : ''),
        )
      } catch (e) {
        console.log('[0552_investigate] URL: ' + u + ' -> Exception: ' + e)
      }
    }

    // 2. Para cada um dos anúncios alvo:
    // - GET /items/{id} (deal_ids, original_price, tags, price, catalog_listing, catalog_product_id, sale_terms)
    // - GET /seller-promotions/items/{id}?app_version=v2
    // - GET /items/{id}/promotions
    // - GET /items/{id}/prices
    // - PUT /items/{id} com price: 2199 para capturar o payload completo exato e headers
    for (let t = 0; t < targetIds.length; t++) {
      const mlbId = targetIds[t]
      console.log('=== [0552_investigate] PERICIA ITEM ' + mlbId + ' ===')

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
          console.log(
            '[0552_investigate] ' +
              mlbId +
              ' GET item: title=' +
              d.title +
              ' | price=' +
              d.price +
              ' | original_price=' +
              d.original_price +
              ' | deal_ids=' +
              JSON.stringify(d.deal_ids) +
              ' | tags=' +
              JSON.stringify(d.tags) +
              ' | catalog_listing=' +
              d.catalog_listing +
              ' | catalog_product_id=' +
              d.catalog_product_id +
              ' | official_store_id=' +
              d.official_store_id,
          )
        } else {
          console.log(
            '[0552_investigate] ' +
              mlbId +
              ' GET item status ' +
              itemRes.statusCode +
              ': ' +
              itemRes.raw,
          )
        }
      } catch (e) {
        console.log('[0552_investigate] ' + mlbId + ' GET item exc: ' + e)
      }

      // 2.2 GET /seller-promotions/items/{id}
      const itemPromoUrls = [
        'https://api.mercadolibre.com/seller-promotions/items/' + mlbId + '?app_version=v2',
        'https://api.mercadolibre.com/items/' + mlbId + '/promotions',
        'https://api.mercadolibre.com/items/' + mlbId + '/prices',
      ]

      for (let p = 0; p < itemPromoUrls.length; p++) {
        const pu = itemPromoUrls[p]
        try {
          const prRes = $http.send({
            url: pu,
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + token,
              Accept: 'application/json',
            },
            timeout: 15,
          })
          console.log(
            '[0552_investigate] ' +
              mlbId +
              ' ' +
              pu +
              ' -> HTTP ' +
              prRes.statusCode +
              ' | ' +
              (prRes.raw ? prRes.raw.substring(0, 400) : ''),
          )
        } catch (e) {
          console.log('[0552_investigate] ' + mlbId + ' ' + pu + ' exc: ' + e)
        }
      }

      // 2.3 Executar PUT de preço para capturar o body COMPLETO de erro (headers e json)
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
        console.log(
          '[0552_investigate] ' +
            mlbId +
            ' PUT /items HTTP ' +
            putRes.statusCode +
            ' | headers=' +
            JSON.stringify(putRes.headers) +
            ' | body=' +
            (putRes.raw || JSON.stringify(putRes.json)),
        )
      } catch (e) {
        console.log('[0552_investigate] ' + mlbId + ' PUT /items exc: ' + e)
      }
    }
  },
  (app) => {
    // no-op revert
  },
)
