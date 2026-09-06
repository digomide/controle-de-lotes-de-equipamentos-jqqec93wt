migrate(
  (app) => {
    const settingsList = app.findRecordsByFilter('ml_settings', '', '-created', 1, 0)
    if (!settingsList || settingsList.length === 0) return
    const s = settingsList[0]
    let token = s.getString('access_token')

    let parentData = null
    try {
      const res = $http.send({
        url: 'https://api.mercadolibre.com/products/MLB50747891',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 15,
      })
      parentData = res.json
    } catch (_) {}

    // Pegar children_ids do pai
    const children = parentData?.children_ids || []

    // Inspecionar os filhos
    const childrenDetails = []
    for (let i = 0; i < Math.min(children.length, 10); i++) {
      try {
        const cRes = $http.send({
          url: 'https://api.mercadolibre.com/products/' + children[i],
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 15,
        })
        if (cRes.statusCode === 200 && cRes.json) {
          const cJson = cRes.json
          // Procurar ITEM_CONDITION
          const ic = (cJson.attributes || []).find((a) => a.id === 'ITEM_CONDITION')
          childrenDetails.push({
            id: cJson.id,
            name: cJson.name,
            cond: cJson.condition,
            ic_val: ic ? ic.value_name || ic.value_id : 'NONE',
          })
        }
      } catch (_) {}
    }

    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'lo0rtbzlgq6a5el')
    r.set(
      'error_message',
      JSON.stringify({
        parent_name: parentData?.name,
        children_count: children.length,
        children: childrenDetails,
      }).substring(0, 4000),
    )
    app.save(r)
  },
  (app) => {},
)
