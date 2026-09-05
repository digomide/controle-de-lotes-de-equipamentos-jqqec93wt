migrate(
  (app) => {
    // 0107_save_to_title_field.js
    // Vamos salvar no campo 'notes' da colecao 'ml_competitors' se houver, ou criar um registro dummy
    const compCol = app.findCollectionByNameOrId('ml_competitors')
    const job = app.findFirstRecordByData(
      'ml_competitor_jobs',
      'query',
      'probe_mlb_sources_2010941196',
    )
    const errText = job.getString('error_message')

    // Salvar numa anotação de competitor
    let rec = null
    try {
      rec = app.findFirstRecordByData('ml_competitors', 'seller_id', 'diag_test')
    } catch (_) {
      rec = new Record(compCol)
      rec.set('seller_id', 'diag_test')
      rec.set('nickname', 'Diag Test')
      rec.set('active', false)
    }
    rec.set('notes', errText.substring(0, 500))
    app.save(rec)
  },
  (app) => {},
)
