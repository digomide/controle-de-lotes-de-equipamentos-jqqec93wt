migrate(
  (app) => {
    const settingsList = app.findRecordsByFilter('ml_settings', '', '-created', 1, 0)
    if (!settingsList || settingsList.length === 0) return
    const s = settingsList[0]
    const token = s.getString('access_token')

    let resText = ''
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/products/MLB45029928',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
        },
        timeout: 15,
      })
      const d = res.json || {}
      const condAttr = (d.attributes || []).find(
        (a) => (a.id || '').toUpperCase().indexOf('COND') >= 0,
      )
      resText =
        'status: ' +
        d.status +
        ' condition: ' +
        d.condition +
        ' attr: ' +
        JSON.stringify(condAttr) +
        ' buy_box_winner: ' +
        (d.buy_box_winner ? d.buy_box_winner.item_id : 'none')
    } catch (e) {
      resText = 'ERR: ' + e.message
    }

    const r2 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'j8totkrrqbeo9uj')
    r2.set('error_message', resText.substring(0, 500))
    app.save(r2)
  },
  (app) => {},
)
