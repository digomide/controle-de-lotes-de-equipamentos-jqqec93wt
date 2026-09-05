migrate(
  (app) => {
    const job = app.findFirstRecordByData('ml_catalog_search_jobs', 'id', 'szg3o742i7qawmh')
    let rawJsonStr = job.getString('results')
    let parsed = JSON.parse(rawJsonStr)

    let countNew = 0
    let countUsed = 0
    let countRefurbished = 0
    let countUnknown = 0
    let samples = []

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i]
      if (item.condition === 'new') countNew++
      else if (item.condition === 'used') countUsed++
      else if (item.condition === 'refurbished') countRefurbished++
      else countUnknown++

      if (i < 5) {
        samples.push({
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
        parsedLen: parsed.length,
        countNew: countNew,
        countUsed: countUsed,
        countRefurbished: countRefurbished,
        countUnknown: countUnknown,
        samples: samples,
      }),
    )
    app.save(job)
  },
  (app) => {},
)
