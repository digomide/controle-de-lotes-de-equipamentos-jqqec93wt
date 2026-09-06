migrate(
  (app) => {
    const testJob = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const raw = testJob.getString('error_message') || ''
    try {
      const data = JSON.parse(raw)
      const snip = data.listSnippet || ''
      // Procurar "vendido" dentro de listSnippet
      const vMatch = snip.match(
        /(\+?[0-9.]+\s*mil\s*vendidos|\+?[0-9.]+\s*vendidos|[0-9.]+\s*vendidos)/i,
      )
      const out =
        'snippetLen=' +
        snip.length +
        ' | vMatch=' +
        (vMatch ? vMatch[0] : 'null') +
        ' | snipStart=' +
        snip.substring(0, 150)
      testJob.set('seller_nickname', out.substring(0, 240))
      app.save(testJob)
    } catch (e) {
      testJob.set('seller_nickname', 'err: ' + String(e))
      app.save(testJob)
    }
  },
  (app) => {},
)
