migrate(
  (app) => {
    const r1 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'ekv6wnr3kc24msq')
    r1.set(
      'error_message',
      'O ML recusou a condição "Recondicionado" nesta posição. A posição MLB75369005 aceita somente: Category MLB1652 for channel marketplace only supports conditions: [used, new, not_specified].. Procure no explorador a posição recondicionada equivalente deste produto e publique nela.',
    )
    app.save(r1)

    const r2 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'j8totkrrqbeo9uj')
    r2.set(
      'error_message',
      'O ML recusou a condição "Recondicionado" nesta posição. A posição MLB45029928 aceita somente: Category MLB1652 for channel marketplace only supports conditions: [used, new, not_specified].. Procure no explorador a posição recondicionada equivalente deste produto e publique nela.',
    )
    app.save(r2)
  },
  (app) => {},
)
