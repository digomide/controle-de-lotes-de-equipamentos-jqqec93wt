migrate(
  (app) => {
    // 0066_clean_test_jobs.js
    // Limpa jobs de teste criados durante a verificação de sanidade
    try {
      app.db().newQuery("DELETE FROM mp_test_jobs WHERE token_override LIKE '%TESTE%'").execute()
    } catch (_) {}
  },
  (app) => {},
)
