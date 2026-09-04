migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}

    const accessToken = settings ? settings.getString('access_token') : ''

    // Buscar detalhes do item MLB7590950114 ou MLB7591024470 (o que o usuário editou na UI)
    // Vamos buscar ambos os itens
    const itemIds = ['MLB7590950114', 'MLB7591024470']
    for (let i = 0; i < itemIds.length; i++) {
      const id = itemIds[i]
      try {
        const res = $http.send({
          url: 'https://api.mercadolibre.com/items/' + id,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + accessToken },
          timeout: 15,
        })
        console.log('=== ITEM ' + id + ' STATUS ' + res.statusCode + ' ===')
        if (res.statusCode === 200) {
          const d = res.json
          console.log(
            'ITEM_INFO:',
            JSON.stringify({
              id: d.id,
              title: d.title,
              condition: d.condition,
              status: d.status,
              user_product_id: d.user_product_id,
              catalog_product_id: d.catalog_product_id,
              domain_id: d.domain_id,
              variations: d.variations,
              attributes: (d.attributes || []).map((a) => ({
                id: a.id,
                name: a.name,
                value_id: a.value_id,
                value_name: a.value_name,
              })),
              sub_status: d.sub_status,
              tags: d.tags,
            }),
          )

          // Se tiver user_product_id, inspecionar o user product
          if (d.user_product_id) {
            try {
              const upRes = $http.send({
                url: 'https://api.mercadolibre.com/user-products/' + d.user_product_id,
                method: 'GET',
                headers: { Authorization: 'Bearer ' + accessToken },
                timeout: 15,
              })
              console.log(
                'USER_PRODUCT ' + d.user_product_id + ' STATUS ' + upRes.statusCode + ':',
                JSON.stringify(upRes.json),
              )
            } catch (eUp) {
              console.log('ERRO UP:', eUp)
            }
          }
        }
      } catch (err) {
        console.log('ERRO ITEM ' + id + ':', err)
      }
    }
  },
  (app) => {},
)
