/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoint para leitura honesta da página pública do anúncio Mercado Livre (/p/MLB... ou /MLB-...)
 * Extrai sold_quantity real anunciado ("+N vendidos", "N vendas") quando disponível.
 * Se o ML bloquear por WAF ou não expuser, retorna status honesto sem fabricar dados.
 */
routerAdd('POST', '/api/ml-ad-scrape-sold', (e) => {
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
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
    try {
      const res = $http.send({
        url: targetUrl,
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        timeout: 8,
      })

      const status = res.statusCode
      const html = res.raw || ''

      if (status !== 200) {
        attempts.push({ url: targetUrl, status: 'http_' + status })
        continue
      }

      if (
        html.includes('suspicious-traffic') ||
        html.includes('account-verification') ||
        html.includes('captcha')
      ) {
        attempts.push({ url: targetUrl, status: 'blocked_waf' })
        finalStatus = 'blocked_waf'
        continue
      }

      // Regex para contadores visíveis no Mercado Livre Brasil:
      // Ex: "+100 vendidos", "+5 mil vendidos", "2 vendidos", "12 vendas"
      const textRegex = /\+?\s*([0-9.]+)\s*(mil\s*)?(?:vendidos|vendidas|vendas)/i
      const match = html.match(textRegex)

      if (match && match[1]) {
        let count = parseFloat(match[1].replace(/\./g, ''))
        if (match[2] && match[2].toLowerCase().includes('mil')) {
          count = count * 1000
        }
        if (!isNaN(count) && count >= 0) {
          soldQuantity = Math.round(count)
          attempts.push({ url: targetUrl, status: 'extracted_from_html', found: soldQuantity })
          finalStatus = 'success'
          break
        }
      }

      // Tenta JSON de estado pré-carregado do ML (__PRELOADED_STATE__ ou initial_state)
      const jsonStateRegex = /"sold_quantity":\s*([0-9]+)/i
      const stateMatch = html.match(jsonStateRegex)
      if (stateMatch && stateMatch[1]) {
        const count = parseInt(stateMatch[1], 10)
        if (!isNaN(count)) {
          soldQuantity = count
          attempts.push({
            url: targetUrl,
            status: 'extracted_from_json_state',
            found: soldQuantity,
          })
          finalStatus = 'success'
          break
        }
      }

      attempts.push({ url: targetUrl, status: 'no_counter_in_page' })
    } catch (err) {
      attempts.push({ url: targetUrl, status: 'network_error', error: String(err) })
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
