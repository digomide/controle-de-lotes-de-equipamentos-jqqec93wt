/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoint para leitura e auditoria honesta de vendas do Mercado Livre.
 *
 * RELATÓRIO TÉCNICO DE INVESTIGAÇÃO DA CHARADA DO CONTADOR PÚBLICO:
 * 1. Testes reais server-side executados contra lista pública e anúncios:
 *    (a) https://lista.mercadolivre.com.br/cooler-lenovo-m900
 *    (b) https://www.mercadolivre.com.br/cooler-lenovo-thinkcentre-com-dissipador-m700-m800-m900/p/MLB45689954
 *    (c) https://produto.mercadolivre.com.br/MLB-45689954
 *
 * 2. Resultado dos testes:
 *    - Status HTTP: 200 OK.
 *    - Conteúdo retornado pelo ML em requisições server-side de datacenters na nuvem:
 *      HTML de bloqueio anti-bot / WAF:
 *      data-assets-prefix="https://http2.mlstatic.com/frontend-assets/suspicious-traffic-frontend/"
 *    - O Mercado Livre identifica chamadas server-side (sem sessão interativa residencial / TLS fingerprinting)
 *      e entrega a casca 'suspicious-traffic-frontend', sem o DOM com os componentes React renderizados.
 *    - No browser do usuário residencial comum, o contador "+5 vendidos", "+25 vendidos" aparece
 *      porque o browser dele possui cookies de sessão humana, IP residencial e resolve os desafios JS.
 *    - Tentativas via API /items/{id} retornam 403 UNAUTHORIZED (bloqueio oficial do ML desde 2024 para terceiros).
 *    - Tentativas via API /sites/MLB/search com token retornam 403.
 *
 * 3. Como este leitor atua com total honestidade:
 *    - Tenta ler páginas e extrair via regex contadores reais ("+N vendidos", "N vendas", "sold_quantity").
 *    - Se detectar suspicious-traffic, reporta explicitamente status 'blocked_waf' ("WAF / Anti-bot Mercado Livre").
 *    - Suporta endpoints em lote para auditar múltiplos anúncios sem sobrecarregar.
 *    - NUNCA inventa ou estima vendas: quando indisponível, sinaliza "Não exposto / Bloqueio WAF".
 */
routerAdd('POST', '/api/ml-ad-scrape-sold', (e) => {
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  // Suporte a requisição em lote (batch de itens para o Raio-X ou Monitor)
  const itemsList = Array.isArray(body.items) ? body.items : null

  function inspectPage(targetUrl) {
    try {
      const res = $http.send({
        url: targetUrl,
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 8,
      })

      const status = res.statusCode
      const html = res.raw || ''

      if (status !== 200) {
        return {
          soldQuantity: null,
          status: 'http_' + status,
          wafBlocked: false,
        }
      }

      if (
        html.includes('suspicious-traffic') ||
        html.includes('account-verification') ||
        html.includes('captcha')
      ) {
        return {
          soldQuantity: null,
          status: 'blocked_waf',
          wafBlocked: true,
          reason: 'Bloqueio de tráfego automatizado do Mercado Livre (suspicious-traffic WAF)',
        }
      }

      // Regex para contadores visíveis no Mercado Livre Brasil
      const textRegex = /\+?\s*([0-9.]+)\s*(mil\s*)?(?:vendidos|vendidas|vendas)/i
      const match = html.match(textRegex)
      if (match && match[1]) {
        let count = parseFloat(match[1].replace(/\./g, ''))
        if (match[2] && match[2].toLowerCase().includes('mil')) {
          count = count * 1000
        }
        if (!isNaN(count) && count >= 0) {
          return {
            soldQuantity: Math.round(count),
            status: 'success',
            wafBlocked: false,
            source: 'html_text',
          }
        }
      }

      // Tenta JSON de estado pré-carregado do ML (__PRELOADED_STATE__ ou initial_state)
      const jsonStateRegex = /"sold_quantity":\s*([0-9]+)/i
      const stateMatch = html.match(jsonStateRegex)
      if (stateMatch && stateMatch[1]) {
        const count = parseInt(stateMatch[1], 10)
        if (!isNaN(count)) {
          return {
            soldQuantity: count,
            status: 'success',
            wafBlocked: false,
            source: 'json_preloaded_state',
          }
        }
      }

      return {
        soldQuantity: null,
        status: 'no_counter_in_page',
        wafBlocked: false,
        reason: 'Página retornou 200 OK sem contador de vendas no markup público',
      }
    } catch (err) {
      return {
        soldQuantity: null,
        status: 'network_error',
        error: String(err),
        wafBlocked: false,
      }
    }
  }

  // Se for batch
  if (itemsList && itemsList.length > 0) {
    const batchResults = {}
    const maxItems = Math.min(itemsList.length, 25)
    for (let bIdx = 0; bIdx < maxItems; bIdx++) {
      const it = itemsList[bIdx]
      const itId = String(it.item_id || it.id || '')
        .trim()
        .toUpperCase()
      const itPermalink = String(it.permalink || '').trim()
      const targetUrl =
        itPermalink ||
        (itId ? 'https://produto.mercadolivre.com.br/' + encodeURIComponent(itId) : '')
      if (targetUrl) {
        const resProbe = inspectPage(targetUrl)
        batchResults[itId || targetUrl] = resProbe
        if (resProbe.soldQuantity != null && itId) {
          try {
            const records = $app.findRecordsByFilter(
              'ml_ad_snapshots',
              "item_id = '" + itId + "'",
              '-created',
              2,
              0,
            )
            for (let r = 0; r < records.length; r++) {
              const snap = records[r]
              snap.set('sold_quantity', resProbe.soldQuantity)
              $app.save(snap)
            }
          } catch (_) {}
        }
      }
    }

    return e.json(200, {
      batch: true,
      count: Object.keys(batchResults).length,
      results: batchResults,
      waf_explanation:
        'O Mercado Livre intercepta requisições server-side com WAF/suspicious-traffic, ocultando o contador caso o browser residencial não esteja executando o JavaScript.',
    })
  }

  const itemId = String(body.item_id || body.id || '')
    .trim()
    .toUpperCase()
  const permalink = String(body.permalink || '').trim()

  if (!itemId && !permalink) {
    return e.json(400, { error: 'item_id ou permalink é obrigatório' })
  }

  const urlsToTry = []
  if (permalink && permalink.startsWith('http')) {
    urlsToTry.push(permalink)
  }
  if (itemId) {
    if (itemId.startsWith('MLB') && !itemId.startsWith('MLB-')) {
      urlsToTry.push('https://produto.mercadolivre.com.br/' + encodeURIComponent(itemId))
      urlsToTry.push('https://www.mercadolivre.com.br/p/' + encodeURIComponent(itemId))
    } else {
      urlsToTry.push('https://produto.mercadolivre.com.br/' + encodeURIComponent(itemId))
    }
  }

  let soldQuantity = null
  let attempts = []
  let finalStatus = 'not_found'

  for (let i = 0; i < urlsToTry.length; i++) {
    const targetUrl = urlsToTry[i]
    const probe = inspectPage(targetUrl)
    attempts.push({ url: targetUrl, ...probe })
    if (probe.soldQuantity != null) {
      soldQuantity = probe.soldQuantity
      finalStatus = 'success'
      break
    } else if (probe.status === 'blocked_waf') {
      finalStatus = 'blocked_waf'
    } else if (finalStatus === 'not_found') {
      finalStatus = probe.status
    }
  }

  // Se tivermos gravado no ml_ad_snapshots para hoje ou recente, opcionalmente atualizar se encontrou sold_quantity
  if (soldQuantity != null && itemId) {
    try {
      const records = $app.findRecordsByFilter(
        'ml_ad_snapshots',
        "item_id = '" + itemId + "'",
        '-created',
        5,
        0,
      )
      for (let r = 0; r < records.length; r++) {
        const snap = records[r]
        if (snap.getInt('sold_quantity') === 0 || snap.get('sold_quantity') == null) {
          snap.set('sold_quantity', soldQuantity)
          $app.save(snap)
        }
      }
    } catch (eSave) {
      // Gravação opcional, não falha a resposta
    }
  }

  return e.json(200, {
    item_id: itemId,
    permalink: permalink || null,
    sold_quantity: soldQuantity,
    status: finalStatus,
    has_exposed_sales: soldQuantity != null,
    attempts: attempts,
  })
})
