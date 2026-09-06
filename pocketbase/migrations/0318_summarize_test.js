migrate(
  (app) => {
    const r = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'lo0rtbzlgq6a5el')
    const raw = r.getString('error_message') || ''

    // Formatar cada teste em linhas simples
    const parts = raw.split(' \n||| ')
    for (let i = 0; i < parts.length; i++) {
      let p = parts[i]
      // Resumo limpo
      let statusMatch = p.match(/status (\d+)/)
      let status = statusMatch ? statusMatch[1] : ''
      let hasLostMe1Only = p.indexOf('lost_me1_by_user') >= 0 && p.indexOf('item.') === -1
      console.log('TEST_' + i + ' => ' + parts[i].substring(0, 100))
    }
  },
  (app) => {},
)
