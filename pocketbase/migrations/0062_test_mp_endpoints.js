migrate(
  (app) => {
    // 0062_test_mp_endpoints.js
    const backendUrl =
      $os.getenv('VITE_POCKETBASE_URL') ||
      'https://controle-de-lotes-de-equipamentos-25024.shrd00.internal.goskip.dev'
    const res = $http.send({
      url: backendUrl + '/api/store/mp/public-config',
      method: 'GET',
      timeout: 10,
    })
    if (res.statusCode === 404) {
      throw new Error('[0062_test] ROTA RETORNOU 404: body=' + res.raw)
    } else {
      throw new Error(
        '[0062_test] ROTA RESPONDEU COM SUCESSO: status=' + res.statusCode + ' body=' + res.raw,
      )
    }
  },
  (app) => {},
)
