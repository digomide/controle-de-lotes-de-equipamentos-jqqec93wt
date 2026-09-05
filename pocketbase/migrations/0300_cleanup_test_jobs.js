migrate(
  (app) => {
    // Limpar jobs de teste criados nesta e na validação anterior
    const col = app.findCollectionByNameOrId('ml_catalog_search_jobs')
    const testIds = ['4p4slpytto0a5zu', 'iw6ad91pqueztf7', 'qcz2l336aduq3ky', '766uxp4jqml8xp2']

    for (let i = 0; i < testIds.length; i++) {
      try {
        const r = app.findRecordById(col, testIds[i])
        if (r) {
          app.delete(r)
        }
      } catch (_) {}
    }
  },
  (app) => {},
)
