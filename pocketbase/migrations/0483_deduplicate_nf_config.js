/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Deduplicação da coleção nf_config:
    // Manter unicamente o registro 'febicvnoy5756vb' com todos os seus dados preservados.
    // Excluir qualquer outro registro duplicado (ex: j8vnznxt08i9qqi, 1jdlbdmne9fm3v8, 68qr7kgns4hovw4).
    if (app.hasTable('nf_config')) {
      const records = app.findRecordsByFilter('nf_config', '1=1', '', 50, 0)
      let keptCount = 0
      let deletedCount = 0

      // Garante que o registro canônico febicvnoy5756vb tem os dados consolidados exatos
      try {
        const canonical = app.findRecordById('nf_config', 'febicvnoy5756vb')
        if (canonical) {
          canonical.set('focus_token', 'rxEjzaYwLQuuCsbP9xDOWrhd0qxAWh42')
          canonical.set('environment', 'homologacao')
          canonical.set('serie_nfe', '2')
          canonical.set('proximo_numero_nfe', 1)
          canonical.set('default_cfop_estadual', '5405')
          canonical.set('default_cfop_interestadual', '6404')
          canonical.set('default_csosn', '102')
          canonical.set('default_ncm', '84713012')
          canonical.set('natureza_operacao_padrao', 'VENDA DE MERCADORIA USADA')
          canonical.set('regime_tributario', '1')
          canonical.set('cnpj', '40157011000102')
          canonical.set('razao_social', 'Rodrigo Gomide Vasconcelos de Barros Informática')
          canonical.set('nome_fantasia', 'INFOPRECOBAIXO')
          canonical.set('inscricao_estadual', '003924266.00-78')
          canonical.set('logradouro', 'Praça Urupês')
          canonical.set('numero', '75')
          canonical.set('complemento', 'Fundos')
          canonical.set('bairro', 'Renascença')
          canonical.set('municipio', 'Belo Horizonte')
          canonical.set('uf', 'MG')
          canonical.set('cep', '31130410')
          canonical.set(
            'informacoes_complementares_padrao',
            'Documento emitido por ME ou EPP optante pelo Simples Nacional.',
          )
          if (!canonical.getString('certificate_password')) {
            canonical.set('certificate_password', 'BF9A63YDN2XHLQ')
          }
          app.save(canonical)
          keptCount++
          console.log('[0483] Registro canonico febicvnoy5756vb atualizado e preservado')
        }
      } catch (e) {
        console.log('[0483] Erro ao carregar canonical febicvnoy5756vb: ' + e)
      }

      for (const rec of records) {
        if (rec.id !== 'febicvnoy5756vb') {
          try {
            app.delete(rec)
            deletedCount++
            console.log('[0483] Registro duplicado removido: ' + rec.id)
          } catch (delErr) {
            console.log('[0483] Erro ao excluir duplicado ' + rec.id + ': ' + delErr)
          }
        }
      }

      console.log(
        '[0483] Deduplicacao concluida. Mantidos: ' + keptCount + ', Excluidos: ' + deletedCount,
      )
    }
  },
  (app) => {
    // Reversão não é necessária para exclusão de dados duplicados de configuração
  },
)
