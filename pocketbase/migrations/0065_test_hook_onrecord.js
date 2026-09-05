migrate(
  (app) => {
    // 0065_test_hook_onrecord.js
    // Testa especificamente se o hook onRecordAfterCreateSuccess('mp_test_jobs') executa
    // ao criar um registro com status 'pending'.
    const col = app.findCollectionByNameOrId('mp_test_jobs')
    const rec = new Record(col)
    rec.set('token_override', 'APP_USR-TESTE-INVALIDO-12345')
    rec.set('status', 'pending')
    app.save(rec)
    console.log(
      '[0065_test] Criado registro pending id=' +
        rec.id +
        ', status após save=' +
        rec.getString('status'),
    )
  },
  (app) => {},
)
