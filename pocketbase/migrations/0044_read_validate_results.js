migrate(
  (app) => {
    const pRecord = app.findRecordById('products', '82b1k0m0l2hanr3')
    const results = JSON.parse(pRecord.getString('bench_notes') || '[]')
    for (let i = 0; i < results.length; i++) {
      console.log(
        'TEST_RESULT ' + i + ':',
        results[i].test,
        'STATUS:',
        results[i].status,
        'BODY:',
        JSON.stringify(results[i].body),
      )
    }
  },
  (app) => {},
)
