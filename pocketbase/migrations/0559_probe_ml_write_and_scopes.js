/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 0559_probe_ml_write_and_scopes:
    // Diagnosticar escopos do token atual e testar escrita inofensiva no ML
    const settings = app.findFirstRecordByFilter('ml_settings', 'tenant_id = "ambicorpmestre1"')
    if (!settings) {
      console.log('[0559_diag] ml_settings não encontrado para ambicorpmestre1')
      return
    }

    const accessToken = settings.getString('access_token')
    const clientId = settings.getString('client_id')
    const refreshToken = settings.getString('refresh_token')

    console.log('[0559_diag] Iniciando diagnóstico com Client ID: ' + clientId)

    // 1. Inspecionar /users/me com token atual
    try {
      const meRes = $http.send({
        url: 'https://api.mercadolibre.com/users/me',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + accessToken },
        timeout: 15,
      })
      console.log(
        '[0559_diag] GET /users/me status: ' +
          meRes.statusCode +
          ', headers: ' +
          JSON.stringify(meRes.headers),
      )
    } catch (e) {
      console.log('[0559_diag] Erro GET /users/me: ' + e)
    }

    // 2. Inspecionar /users/{id}/applications/{client_id} se disponível
    try {
      const appRes = $http.send({
        url: 'https://api.mercadolibre.com/applications/' + clientId,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + accessToken },
        timeout: 15,
      })
      console.log(
        '[0559_diag] GET /applications/' +
          clientId +
          ' status: ' +
          appRes.statusCode +
          ', scopes: ' +
          JSON.stringify(appRes.json ? appRes.json.scopes : null) +
          ', body: ' +
          (appRes.raw ? appRes.raw.substring(0, 300) : ''),
      )
    } catch (e) {
      console.log('[0559_diag] Erro GET /applications: ' + e)
    }

    // 3. Teste de escrita inofensivo:
    // Buscar um item pausado do vendedor (ex: MLB1742167330 ou MLB3144369320 ou MLB7591024470)
    // Ler os dados atuais do item MLB7591024470 (Dell Inspiron 15-3576, que falhou no log)
    const testItemId = 'MLB7591024470'
    let currentQty = 1
    try {
      const itemGetRes = $http.send({
        url: 'https://api.mercadolibre.com/items/' + testItemId,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + accessToken },
        timeout: 15,
      })
      console.log('[0559_diag] GET /items/' + testItemId + ' status: ' + itemGetRes.statusCode)
      if (itemGetRes.statusCode === 200 && itemGetRes.json) {
        currentQty = itemGetRes.json.available_quantity || 1
        console.log(
          '[0559_diag] Item atual: status=' +
            itemGetRes.json.status +
            ', sub_status=' +
            JSON.stringify(itemGetRes.json.sub_status) +
            ', qty=' +
            currentQty +
            ', price=' +
            itemGetRes.json.price +
            ', catalog_listing=' +
            itemGetRes.json.catalog_listing +
            ', catalog_product_id=' +
            itemGetRes.json.catalog_product_id,
        )
      }
    } catch (e) {
      console.log('[0559_diag] Erro GET item: ' + e)
    }

    // Teste A: PUT em available_quantity com o MESMO valor atual (inofensivo)
    try {
      const putStockRes = $http.send({
        url: 'https://api.mercadolibre.com/items/' + testItemId,
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ available_quantity: currentQty }),
        timeout: 15,
      })
      console.log(
        '[0559_diag] TESTE_A PUT stock (' +
          currentQty +
          ') -> status: ' +
          putStockRes.statusCode +
          ', headers: ' +
          JSON.stringify(putStockRes.headers) +
          ', body: ' +
          putStockRes.raw,
      )
    } catch (e) {
      console.log('[0559_diag] TESTE_A erro de rede: ' + e)
    }

    // Teste B: PUT de preço com o MESMO preço atual (inofensivo, valor não altera)
    try {
      const putPriceRes = $http.send({
        url: 'https://api.mercadolibre.com/items/' + testItemId,
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ price: 2190 }),
        timeout: 15,
      })
      console.log(
        '[0559_diag] TESTE_B PUT price (2190) -> status: ' +
          putPriceRes.statusCode +
          ', headers: ' +
          JSON.stringify(putPriceRes.headers) +
          ', body: ' +
          putPriceRes.raw,
      )
    } catch (e) {
      console.log('[0559_diag] TESTE_B erro de rede: ' + e)
    }

    // Teste C: Verificar status de autorização / concessão em /users/626774396/applications/253167816099623
    try {
      const grantRes = $http.send({
        url: 'https://api.mercadolibre.com/users/626774396/applications/' + clientId,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + accessToken },
        timeout: 15,
      })
      console.log(
        '[0559_diag] GET /users/626774396/applications/' +
          clientId +
          ' status: ' +
          grantRes.statusCode +
          ', body: ' +
          grantRes.raw,
      )
    } catch (e) {
      console.log('[0559_diag] Erro GET user application grant: ' + e)
    }
  },
  (app) => {},
)
