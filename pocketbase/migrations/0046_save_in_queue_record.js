migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Restaurar serial_number original do T580
    const pRecord = app.findRecordById('products', '82b1k0m0l2hanr3')
    const valSummary = pRecord.getString('serial_number')
    pRecord.set('serial_number', 'R90S2BGP')
    pRecord.set('bench_notes', '')
    app.save(pRecord)

    // Criar um registro em ml_publish_queue com status 'done'
    // contendo o resumo dos testes
    const qCol = app.findCollectionByNameOrId('ml_publish_queue')
    const qRec = new Record(qCol)
    qRec.set('product', '82b1k0m0l2hanr3')
    qRec.set('status', 'done')
    qRec.set('error_message', valSummary)
    qRec.set('result', { summary: valSummary })
    app.save(qRec)
  },
  (app) => {},
)
