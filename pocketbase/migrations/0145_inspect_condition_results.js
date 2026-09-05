migrate(
  (app) => {
    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    const results = job.get('results') || []
    let sampleConditions = []
    let countNew = 0
    let countUsed = 0
    let countRefurbished = 0
    let countUnknown = 0

    for (let i = 0; i < results.length; i++) {
      const item = results[i]
      if (item.condition === 'new') countNew++
      else if (item.condition === 'used') countUsed++
      else if (item.condition === 'refurbished') countRefurbished++
      else countUnknown++

      if (i < 5) {
        sampleConditions.push({
          id: item.catalog_product_id,
          condition: item.condition,
          condition_label: item.condition_label,
          title: (item.title || '').substring(0, 40),
        })
      }
    }

    job.set(
      'error_message',
      JSON.stringify({
        countNew: countNew,
        countUsed: countUsed,
        countRefurbished: countRefurbished,
        countUnknown: countUnknown,
        total: results.length,
        samples: sampleConditions,
      }),
    )
    app.save(job)
  },
  (app) => {
    // rollback
  },
)
