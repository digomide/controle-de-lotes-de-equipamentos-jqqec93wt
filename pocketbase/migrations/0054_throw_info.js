migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Pegar item T580
    const itemRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7590950114',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 15,
    })
    const t580 = itemRes.json || {}
    const cond = (t580.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
    const grad = (t580.attributes || []).find((a) => a.id === 'GRADING')

    // Se tudo certo, passar suavemente
  },
  (app) => {},
)
