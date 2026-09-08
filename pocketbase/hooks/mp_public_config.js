// Endpoint público para verificar se o Mercado Pago está ativo e obter a public_key para a loja
// Route: GET /backend/v1/store/mp/public-config
// Sem auth (público para a loja saber se exibe o botão ou modo degradado)

routerAdd('GET', '/backend/v1/store/mp/public-config', (e) => {
  let enabled = false
  let publicKey = ''
  let storeTitle = 'AmbicorpFlow'

  try {
    const settings = $app.findRecordsByFilter('mercadopago_settings', '1=1', '-created', 1, 0)
    if (settings && settings.length > 0) {
      const s = settings[0]
      const token = s.getString('mp_access_token')
      const isEnabled = s.getBool('mp_enabled')
      publicKey = s.getString('mp_public_key') || ''
      storeTitle = s.getString('store_title') || 'AmbicorpFlow'
      // Só está ativo de fato se tiver o mp_access_token e mp_enabled === true
      enabled = Boolean(isEnabled && token && token.trim().length > 10)
    }
  } catch (err) {
    console.log('[mp_public_config] Erro ao ler mercadopago_settings: ' + err)
  }

  return e.json(200, {
    enabled: enabled,
    public_key: publicKey,
    store_title: storeTitle,
  })
})
