migrate(
  (app) => {
    let settings = null
    try {
      const sRecords = app.findRecordsByFilter('ml_settings', '1=1', '-created', 1, 0)
      if (sRecords && sRecords.length > 0) settings = sRecords[0]
    } catch (_) {}
    const accessToken = settings ? settings.getString('access_token') : ''

    // Pegar item T580
    const pRecord = app.findRecordById('products', '82b1k0m0l2hanr3')
    const note = pRecord.getString('bench_notes')
    console.log('T580 BENCH NOTE:', note)

    // Agora vamos testar a criação de um item teste em rascunho / teste ou PUT
    // Espera: podemos testar um POST /items com:
    // condition: "new",
    // attributes: [
    //   { id: "ITEM_CONDITION", value_id: "2230582", value_name: "Recondicionado" },
    //   { id: "GRADING", value_id: "40108830", value_name: "Excelente" },
    //   ...
    // ]
    // E também testar se condition: "used" aceita ITEM_CONDITION: "2230582" e GRADING: "40108830".
    // Mas antes, vamos testar atualizar o item MLB7590950114 ou enviar um item novo.
    // Vamos ver se o item MLB7590950114 pode receber PUT nos atributos ITEM_CONDITION e GRADING:
    const putRes = $http.send({
      url: 'https://api.mercadolibre.com/items/MLB7590950114',
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attributes: [
          { id: 'ITEM_CONDITION', value_id: '2230582' },
          { id: 'GRADING', value_id: '40108830' },
        ],
      }),
      timeout: 15,
    })
    console.log(
      'PUT ITEM_CONDITION + GRADING status:',
      putRes.statusCode,
      JSON.stringify(putRes.json),
    )
  },
  (app) => {},
)
