migrate(
  (app) => {
    const r2 = app.findFirstRecordByData('ml_catalog_publish_jobs', 'id', 'xq9ap5apv0jjgcm')
    const txt = r2.getString('error_message')
    // Escrever no campo status de um job de teste temporariamente (apenas 20 chars ou similar)
    // Não, status tem validação de enum ou tamanho.
    // Mas onde mais podemos ver?
    // Podemos ver via list_logs do tipo requests?
    // Não, podemos disparar um $http.get em endpoint público do próprio PB ou do httpbin!
    // Ou simplesmente consultar a collection via SDK/fetch no frontend ou num endpoint.
  },
  (app) => {},
)
