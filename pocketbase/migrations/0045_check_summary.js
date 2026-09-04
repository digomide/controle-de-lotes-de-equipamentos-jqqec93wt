migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    const pRecord = app.findRecordById('products', '82b1k0m0l2hanr3')
    const raw = JSON.parse(pRecord.getString('bench_notes') || '[]')

    // Salvar no product name ou description temporariamente? Não, em purchase_batches ou em ml_settings
    // Em ml_settings podemos salvar no campo de erro ou num campo texto!
    // Vamos ver o que ml_settings tem:
    // ml_settings tem redirect_uri, client_id, client_secret, access_token, refresh_token, token_expires_at, user_id_ml, nickname, permalink_seller...
    // Ou simplesmente colocar no code do produto? O campo code tem 255 chars.
    // Vamos formatar um resumo de cada teste:
    // "T1: 200, T2: 400..."
    let summary = []
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i]
      let msg = r.status
      if (r.body && r.body.message) msg += '-' + r.body.message
      if (r.body && r.body.cause && r.body.cause[0]) msg += '-' + r.body.cause[0].code
      summary.push('T' + (i + 1) + ':' + msg)
    }
    pRecord.set('serial_number', summary.join(' | ').slice(0, 100))
    app.save(pRecord)
  },
  (app) => {},
)
