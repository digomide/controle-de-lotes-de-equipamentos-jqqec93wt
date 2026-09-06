migrate(
  (app) => {
    const job = app.findRecordById('ml_competitor_jobs', 'wp8elpqepb1vao9')
    const raw = job.getString('error_message') || ''
    try {
      const data = JSON.parse(raw)
      console.log('=== INVESTIGATION 0376 ===')
      console.log('1. prodRes:', JSON.stringify(data.prodRes))
      console.log(
        '2. itemsRes count=' +
          (data.itemsRes && data.itemsRes.count) +
          ' sumSold=' +
          (data.itemsRes && data.itemsRes.sumSold) +
          ' maxSold=' +
          (data.itemsRes && data.itemsRes.maxSold),
      )
      if (data.itemsRes && data.itemsRes.sample) {
        console.log('2. items sample:', JSON.stringify(data.itemsRes.sample))
      }
      console.log(
        '3. searchRes total=' +
          (data.searchRes && data.searchRes.total) +
          ' count=' +
          (data.searchRes && data.searchRes.count) +
          ' sumSold=' +
          (data.searchRes && data.searchRes.sumSold),
      )
      if (data.searchRes && data.searchRes.sample) {
        console.log('3. search sample:', JSON.stringify(data.searchRes.sample))
      }
      console.log('4. prodSearchRes:', JSON.stringify(data.prodSearchRes))
    } catch (e) {
      console.log('Err parse:', e, raw.substring(0, 500))
    }
  },
  (app) => {},
)
