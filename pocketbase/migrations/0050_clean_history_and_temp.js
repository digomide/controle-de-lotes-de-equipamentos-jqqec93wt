migrate(
  (app) => {
    const pRecord = app.findRecordById('products', '82b1k0m0l2hanr3')
    let ev = pRecord.get('history_events')
    if (typeof ev === 'string') {
      try {
        ev = JSON.parse(ev)
      } catch (_) {
        ev = []
      }
    }
    if (Array.isArray(ev) && ev.length > 0) {
      const last = ev[ev.length - 1]
      console.log('VALIDATION MSG RESULT:', last ? last.title : '')
      // Manter sem o último
      const cleaned = ev.slice(0, ev.length - 1)
      pRecord.set('history_events', cleaned)
      app.save(pRecord)
    }

    // Deletar o record de fila temporário se tiver o product 82b1k0m0l2hanr3 e não tiver ml_listing_id
    try {
      const qRecs = app.findRecordsByFilter(
        'ml_publish_queue',
        'product = "82b1k0m0l2hanr3" && error_message ~ "not_specified"',
        '-created',
        1,
        0,
      )
      if (qRecs.length > 0) {
        app.delete(qRecs[0])
      }
    } catch (_) {}
  },
  (app) => {},
)
