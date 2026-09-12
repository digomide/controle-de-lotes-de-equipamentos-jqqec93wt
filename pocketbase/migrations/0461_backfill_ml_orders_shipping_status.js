/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Garantir created/updated na coleção ml_orders_sync_jobs se estiverem faltando
    try {
      const jobsCol = app.findCollectionByNameOrId('ml_orders_sync_jobs')
      if (jobsCol) {
        let changed = false
        if (!jobsCol.fields.getByName('created')) {
          jobsCol.fields.add(new AutodateField({ name: 'created', onCreate: true }))
          changed = true
        }
        if (!jobsCol.fields.getByName('updated')) {
          jobsCol.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
          changed = true
        }
        if (changed) {
          app.save(jobsCol)
          console.log('[0461] Campos created/updated adicionados a ml_orders_sync_jobs')
        }
      }
    } catch (errCol) {
      console.log('[0461] Aviso ao verificar campos de ml_orders_sync_jobs: ' + errCol)
    }

    // 2. Atualizar pedidos existentes em ml_orders cujo shipping_status ainda está como 'pending'
    // mas que possuem tag 'delivered' gravada no array de tags do Mercado Livre.
    try {
      const records = app.findRecordsByFilter(
        'ml_orders',
        "shipping_status = 'pending' && tags ~ 'delivered'",
        '-date_created',
        500,
        0,
      )
      let count = 0
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        r.set('shipping_status', 'delivered')
        app.save(r)
        count++
      }
      console.log(
        '[0461] Atualizados ' +
          count +
          ' pedidos ml_orders para shipping_status=delivered com base nas tags ML',
      )
    } catch (err) {
      console.log('[0461] Aviso ao atualizar status de envios entregues: ' + err)
    }
  },
  (app) => {
    // Reversão não é necessária
  },
)
