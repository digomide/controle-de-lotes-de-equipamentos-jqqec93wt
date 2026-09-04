migrate(
  (app) => {
    // Ler o resultado gravado na migration 0048
    const qRecords = app.findRecordsByFilter('ml_publish_queue', '1=1', '-created', 1, 0)
    const qRec = qRecords[0]
    const resMsg = qRec.getString('error_message')

    // Colocar no purchase_batch_id ou model ou outro campo?
    // Vamos salvar no product name temporariamente do T580 e reverter logo em seguida!
    // Melhor ainda: colocar no history_events do produto!
    const pRecord = app.findRecordById('products', '82b1k0m0l2hanr3')
    const ev = pRecord.get('history_events') || []
    const list = Array.isArray(ev) ? [...ev] : []
    list.push({ title: 'VALIDATION_RES: ' + resMsg, date: new Date().toISOString() })
    pRecord.set('history_events', list)
    app.save(pRecord)
  },
  (app) => {},
)
