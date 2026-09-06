migrate(
  (app) => {
    let token = ''
    const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
    if (sRecords && sRecords.length > 0) {
      token = sRecords[0].getString('access_token')
    }

    const testId = 'MLB7273251762'
    // 1. Sem Authorization header
    let anonRes = null
    try {
      const r = $http.send({
        url: 'https://api.mercadolibre.com/items/' + testId,
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 6,
      })
      anonRes = {
        status: r.statusCode,
        sold: r.json ? r.json.sold_quantity : null,
        msg: r.json ? r.json.message : null,
      }
    } catch (e1) {
      anonRes = { err: String(e1) }
    }

    // 2. Multiget /items?ids=MLB7273251762,MLB7273249806
    let multiRes = null
    try {
      const r = $http.send({
        url: 'https://api.mercadolibre.com/items?ids=MLB7273251762,MLB7273249806,MLB7566367408',
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 6,
      })
      const arr = r.json || []
      multiRes = {
        status: r.statusCode,
        results: arr.map(function (item) {
          const body = item.body || {}
          return {
            id: body.id,
            code: item.code,
            sold: body.sold_quantity,
            title: (body.title || '').substring(0, 25),
          }
        }),
      }
    } catch (e2) {
      multiRes = { err: String(e2) }
    }

    // 3. Multiget COM token
    let multiWithToken = null
    try {
      const r = $http.send({
        url: 'https://api.mercadolibre.com/items?ids=MLB7273251762,MLB7273249806,MLB7566367408',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 6,
      })
      const arr = r.json || []
      multiWithToken = {
        status: r.statusCode,
        results: arr.map(function (item) {
          const body = item.body || {}
          return {
            id: body.id,
            code: item.code,
            sold: body.sold_quantity,
            title: (body.title || '').substring(0, 25),
          }
        }),
      }
    } catch (e3) {
      multiWithToken = { err: String(e3) }
    }

    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    job.set(
      'seller_nickname',
      ('anon=' + JSON.stringify(anonRes) + ' | multiAnon=' + JSON.stringify(multiRes)).substring(
        0,
        250,
      ),
    )
    job.set(
      'error_message',
      JSON.stringify({ anonRes: anonRes, multiRes: multiRes, multiWithToken: multiWithToken }),
    )
    app.save(job)
  },
  (app) => {},
)
