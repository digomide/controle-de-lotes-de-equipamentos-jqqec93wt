/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = "@request.auth.id != ''"

    // Coleção ml_question_corrections (Auditoria e log de correções de insights aplicadas aos anúncios do ML)
    if (!app.hasTable('ml_question_corrections')) {
      const col = new Collection({
        name: 'ml_question_corrections',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: AUTH_ALL,
        fields: [
          {
            name: 'item_id',
            type: 'text',
            required: true,
          },
          {
            name: 'item_title',
            type: 'text',
            required: false,
          },
          {
            name: 'item_permalink',
            type: 'text',
            required: false,
          },
          {
            name: 'questions_used',
            type: 'json',
            required: false,
          },
          {
            name: 'proposed_text',
            type: 'text',
            required: true,
          },
          {
            name: 'previous_description',
            type: 'text',
            required: false,
          },
          {
            name: 'final_description',
            type: 'text',
            required: false,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['applied', 'failed'],
            maxSelect: 1,
          },
          {
            name: 'applied_by',
            type: 'text',
            required: false,
          },
          {
            name: 'applied_at',
            type: 'date',
            required: false,
          },
          {
            name: 'error_message',
            type: 'text',
            required: false,
          },
          {
            name: 'api_response',
            type: 'json',
            required: false,
          },
        ],
        indexes: [
          'CREATE INDEX idx_ml_qcorr_item ON ml_question_corrections (item_id)',
          'CREATE INDEX idx_ml_qcorr_status ON ml_question_corrections (status)',
          'CREATE INDEX idx_ml_qcorr_applied ON ml_question_corrections (applied_at)',
        ],
      })
      app.save(col)

      try {
        const colReload = app.findCollectionByNameOrId('ml_question_corrections')
        if (colReload) {
          if (!colReload.fields.getByName('created')) {
            colReload.fields.add(
              new AutodateField({
                name: 'created',
                onCreate: true,
                onUpdate: false,
              }),
            )
          }
          if (!colReload.fields.getByName('updated')) {
            colReload.fields.add(
              new AutodateField({
                name: 'updated',
                onCreate: true,
                onUpdate: true,
              }),
            )
          }
          app.save(colReload)
        }
      } catch (err) {
        console.log('[0496] Erro ao adicionar autodates em ml_question_corrections: ' + err)
      }

      console.log('[0496] Colecao ml_question_corrections criada com sucesso')
    }
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('ml_question_corrections')
      if (c) app.delete(c)
    } catch (_) {}
  },
)
