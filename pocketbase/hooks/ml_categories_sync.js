/**
 * Hook para sincronização sob demanda e agendada da árvore oficial de categorias do Mercado Livre.
 * Endpoints:
 * - GET /backend/v1/ml/categories/tree -> Retorna lista das principais famílias ou subárvore
 * - POST /backend/v1/ml/categories/sync -> Sincroniza/atualiza as principais categorias do ML no banco
 *
 * Cron:
 * - Atualização semanal aos domingos às 03:00 da manhã
 */

// Sincronização semanal agendada
cronAdd('ml_categories_sync_weekly', '0 3 * * 0', () => {
  try {
    const res = $http.send({
      url: 'https://api.mercadolibre.com/sites/MLB/categories',
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: 30,
    })
    if (res.statusCode === 200 && Array.isArray(res.json)) {
      const topCats = res.json
      // Prioridade: Informática (MLB1648), Eletrônicos (MLB1051), Celulares (MLB105188), etc.
      for (let i = 0; i < topCats.length; i++) {
        const cat = topCats[i]
        if (!cat || !cat.id) continue
        try {
          let rec = null
          try {
            rec = $app.findFirstRecordByData('ml_categories', 'category_id', cat.id)
          } catch (_) {}

          if (!rec) {
            const col = $app.findCollectionByNameOrId('ml_categories')
            rec = new Record(col)
            rec.set('category_id', cat.id)
          }
          rec.set('name', cat.name)
          rec.set('family_id', cat.id)
          rec.set('family_name', cat.name)
          rec.set('level', 1)
          rec.set('full_path', cat.name)
          $app.save(rec)
        } catch (_) {}
      }
    }
  } catch (err) {
    console.log('[ml_categories_sync_weekly] Erro na sincronização: ' + err)
  }
})

// Endpoint HTTP para disparar sincronização sob demanda
routerAdd('POST', '/backend/v1/ml/categories/sync', (e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { error: 'Autenticação necessária' })
  }

  try {
    const res = $http.send({
      url: 'https://api.mercadolibre.com/sites/MLB/categories',
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: 30,
    })

    if (res.statusCode !== 200 || !Array.isArray(res.json)) {
      return e.json(502, { error: 'Falha ao consultar API do Mercado Livre' })
    }

    const topCats = res.json
    let savedCount = 0

    // Salvar top-level e descer em Informática e Celulares que são o core do usuário
    const coreTargets = ['MLB1648', 'MLB105188', 'MLB1051']

    for (let i = 0; i < topCats.length; i++) {
      const cat = topCats[i]
      if (!cat || !cat.id) continue

      let rec = null
      try {
        rec = $app.findFirstRecordByData('ml_categories', 'category_id', cat.id)
      } catch (_) {}

      if (!rec) {
        const col = $app.findCollectionByNameOrId('ml_categories')
        rec = new Record(col)
        rec.set('category_id', cat.id)
      }
      rec.set('name', cat.name)
      rec.set('family_id', cat.id)
      rec.set('family_name', cat.name)
      rec.set('level', 1)
      rec.set('full_path', cat.name)
      $app.save(rec)
      savedCount++
    }

    // Aprofundar nas subcategorias de Informática (MLB1648) e Eletrônicos
    for (let c = 0; c < coreTargets.length; c++) {
      const targetId = coreTargets[c]
      try {
        const detailRes = $http.send({
          url: 'https://api.mercadolibre.com/categories/' + targetId,
          method: 'GET',
          headers: { Accept: 'application/json' },
          timeout: 20,
        })
        if (detailRes.statusCode === 200 && detailRes.json) {
          const catDetail = detailRes.json
          const familyName = catDetail.name
          const children = catDetail.children_categories || []

          for (let ch = 0; ch < children.length; ch++) {
            const child = children[ch]
            let childRec = null
            try {
              childRec = $app.findFirstRecordByData('ml_categories', 'category_id', child.id)
            } catch (_) {}

            if (!childRec) {
              const col = $app.findCollectionByNameOrId('ml_categories')
              childRec = new Record(col)
              childRec.set('category_id', child.id)
            }
            childRec.set('name', child.name)
            childRec.set('parent_id', targetId)
            childRec.set('family_id', targetId)
            childRec.set('family_name', familyName)
            childRec.set('subfamily_id', child.id)
            childRec.set('subfamily_name', child.name)
            childRec.set('level', 2)
            childRec.set('full_path', familyName + ' > ' + child.name)
            childRec.set('total_items_in_this_category', child.total_items_in_this_category || 0)
            $app.save(childRec)
            savedCount++
          }
        }
      } catch (_) {}
    }

    return e.json(200, {
      success: true,
      message: 'Categorias do Mercado Livre sincronizadas com sucesso',
      saved_count: savedCount,
    })
  } catch (err) {
    return e.json(500, { error: String(err) })
  }
})
