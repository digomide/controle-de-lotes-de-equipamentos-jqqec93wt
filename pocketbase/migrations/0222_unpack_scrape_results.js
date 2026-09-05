migrate(
  (app) => {
    const job = app.findFirstRecordByData(
      'ml_ads_fetch_jobs',
      'status_filter',
      '__PROBE_SCRAPE_AND_FILTERS__',
    )
    const fullJson = JSON.parse(job.getString('error_message'))

    const col = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    for (let i = 0; i < fullJson.scrapeResults.length; i++) {
      const sr = fullJson.scrapeResults[i]
      const rec = new Record(col)
      rec.set('status', 'done')
      rec.set('status_filter', '__SCRAPE_RES_' + i + '__')
      rec.set(
        'progress_text',
        'status:' + sr.status + ' count:' + sr.catalogIdsCount + ' has2097:' + sr.has2097,
      )
      rec.set('error_message', sr.url + ' -> ' + JSON.stringify(sr.ids))
      app.save(rec)
    }
  },
  (app) => {},
)
