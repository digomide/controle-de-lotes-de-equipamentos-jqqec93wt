migrate(
  (app) => {
    const settingsList = app.findRecordsByFilter('ml_settings', '', '-created', 1, 0)
    if (!settingsList || settingsList.length === 0) return
    const s = settingsList[0]
    let token = s.getString('access_token')

    const basePayload = {
      catalog_product_id: 'MLB50747892',
      catalog_listing: true,
      category_id: 'MLB1652',
      price: 1500,
      currency_id: 'BRL',
      available_quantity: 1,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
      shipping: { mode: 'me2', local_pick_up: true, free_shipping: true },
      sale_terms: [
        { id: 'WARRANTY_TYPE', value_name: 'Garantia do vendedor' },
        { id: 'WARRANTY_TIME', value_name: '90 dias' },
      ],
    }

    // Buscar no ML items recondicionados ativos de notebooks para ver o payload deles!
    let sampleItems = []
    try {
      const sRes = $http.send({
        url: 'https://api.mercadolibre.com/sites/MLB/search?category=MLB1652&condition=2230582&limit=5',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 15,
      })
      sampleItems = (sRes.json?.results || []).map((i) => ({
        id: i.id,
        title: i.title,
        catalog_product_id: i.catalog_product_id,
        catalog_listing: i.catalog_listing,
        condition: i.condition,
        attributes: (i.attributes || [])
          .filter((a) => a.id === 'ITEM_CONDITION')
          .map((a) => ({ id: a.id, val: a.value_name, val_id: a.value_id })),
      }))
    } catch (e) {
      sampleItems = { err: String(e) }
    }

    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'lo0rtbzlgq6a5el')
    r.set('error_message', JSON.stringify({ sampleItems }).substring(0, 4000))
    app.save(r)
  },
  (app) => {},
)
