migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Pegar dados salvos no cache anterior
    const cacheRec = app.findFirstRecordByData('ml_category_cache', 'category_id', 'MLB1652')
    const saved = cacheRec.get('attributes')
    const raw = saved && saved[0] ? saved[0] : {}

    // Vamos desmembrar e gravar em um formato plano legível
    const debug = {
      item1_cond: raw.MLB7590950114 ? raw.MLB7590950114.condition : null,
      item1_attrs: raw.MLB7590950114 ? raw.MLB7590950114.attributes : null,
      item1_variations: raw.MLB7590950114 ? raw.MLB7590950114.variations : null,
      item1_upid: raw.MLB7590950114 ? raw.MLB7590950114.user_product_id : null,
      item1_up_keys: raw.MLB7590950114_up ? Object.keys(raw.MLB7590950114_up) : null,
      item1_up_data: raw.MLB7590950114_up
        ? {
            id: raw.MLB7590950114_up.id,
            status: raw.MLB7590950114_up.status,
            attributes: raw.MLB7590950114_up.attributes,
            variations: raw.MLB7590950114_up.variations,
            parent_id: raw.MLB7590950114_up.parent_id,
            family_name: raw.MLB7590950114_up.family_name,
          }
        : null,
      item2_cond: raw.MLB7591024470 ? raw.MLB7591024470.condition : null,
      item2_attrs: raw.MLB7591024470 ? raw.MLB7591024470.attributes : null,
      item2_variations: raw.MLB7591024470 ? raw.MLB7591024470.variations : null,
      item2_upid: raw.MLB7591024470 ? raw.MLB7591024470.user_product_id : null,
      item2_up_keys: raw.MLB7591024470_up ? Object.keys(raw.MLB7591024470_up) : null,
      item2_up_data: raw.MLB7591024470_up
        ? {
            id: raw.MLB7591024470_up.id,
            status: raw.MLB7591024470_up.status,
            attributes: raw.MLB7591024470_up.attributes,
            variations: raw.MLB7591024470_up.variations,
            parent_id: raw.MLB7591024470_up.parent_id,
            family_name: raw.MLB7591024470_up.family_name,
          }
        : null,
    }

    cacheRec.set('attributes', [debug])
    app.save(cacheRec)
  },
  (app) => {},
)
