migrate(
  (app) => {
    // 1. Limpar registros de teste criados para investigação em ml_ads_fetch_jobs
    const filtersToClean = [
      '__INVESTIGATE_SPECIMEN_1__',
      '__PROD_DETAILS_1__',
      '__PROD_DETAILS_2__',
      '__PROD_DETAILS_3__',
      '__TARGET_ANALYSIS__',
      '__PROD_SUMMARY_EXACT__',
      '__ATTRS_AND_WINNER__',
      '__SEARCH_TERMS_COMPARE__',
      '__TERM_2_AND_3__',
      '__PROD_SUBENDPOINTS__',
      '__PROD_FAMILY_RESULTS__',
      '__AVAILABLE_FILTERS__',
      '__SCRAPE_RECONDICIONADO__',
    ]
    for (let f = 0; f < filtersToClean.length; f++) {
      const recs = app.findRecordsByFilter(
        'ml_ads_fetch_jobs',
        "status_filter = '" + filtersToClean[f] + "'",
        '',
        50,
        0,
      )
      for (let r = 0; r < recs.length; r++) {
        try {
          app.delete(recs[r])
        } catch (_) {}
      }
    }

    // 2. Limpar jobs de busca de teste com query '__INSPECT_MLB2097858038__'
    const searchJobs = app.findRecordsByFilter(
      'ml_catalog_search_jobs',
      "query = '__INSPECT_MLB2097858038__'",
      '',
      20,
      0,
    )
    for (let s = 0; s < searchJobs.length; s++) {
      try {
        app.delete(searchJobs[s])
      } catch (_) {}
    }

    // 3. Criar job real de busca para o espécime MLB2097858038 no catálogo
    const sCol = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    const searchJob = new Record(sCol)
    searchJob.set('status', 'pending')
    searchJob.set('query', 'MLB2097858038')
    searchJob.set('domain_id', '')
    app.save(searchJob)

    // 4. Criar job real de anúncios próprios para garantir dados frescos dos chips de condição
    const aCol = app.findCollectionByNameOrId('ml_ads_fetch_jobs')
    const adsJob = new Record(aCol)
    adsJob.set('status', 'pending')
    adsJob.set('status_filter', '')
    app.save(adsJob)
  },
  (app) => {},
)
