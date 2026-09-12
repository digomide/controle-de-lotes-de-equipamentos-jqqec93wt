/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = "@request.auth.id != ''"

    // 1. Criar coleção ncm_cest se não existir
    if (!app.hasTable('ncm_cest')) {
      const ncmCest = new Collection({
        name: 'ncm_cest',
        type: 'base',
        listRule: AUTH_ALL,
        viewRule: AUTH_ALL,
        createRule: AUTH_ALL,
        updateRule: AUTH_ALL,
        deleteRule: AUTH_ALL,
        fields: [
          {
            name: 'ncm',
            type: 'text',
            required: true,
          },
          {
            name: 'cest',
            type: 'text',
            required: true,
          },
          {
            name: 'descricao',
            type: 'text',
            required: false,
          },
          {
            name: 'segmento',
            type: 'text',
            required: false,
          },
          {
            name: 'item_anexo',
            type: 'text',
            required: false,
          },
        ],
        indexes: [
          'CREATE INDEX idx_ncm_cest_ncm ON ncm_cest (ncm)',
          'CREATE INDEX idx_ncm_cest_cest ON ncm_cest (cest)',
        ],
      })
      app.save(ncmCest)
      console.log('[0484] Coleção ncm_cest criada')

      // 2. Semear registros oficiais do Convênio ICMS 92/15 e alterações posteriores (Convênio ICMS 146/15, 52/17, etc.)
      // Foco em informática, eletrônicos, telecomunicação, periféricos e suprimentos (Segmento 21 - Produtos Eletrônicos, Eletroeletrônicos e Eletrodomésticos)
      // NCMs que NÃO possuem CEST (como 84713012 Notebook e 84717090 HD/SSD) propositalmente NÃO constam nesta tabela.
      const seedItems = [
        // --- MEMÓRIAS E PARTES/ACESSÓRIOS DE COMPUTADORES (8473.30 -> CEST 21.035.00) ---
        {
          ncm: '84733042',
          cest: '21.035.00',
          descricao:
            'Placas (módulos) de memória com superfície <= 50 cm2 (RAM DDR/DDR2/DDR3/DDR4/DDR5)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '35.0',
        },
        {
          ncm: '84733041',
          cest: '21.035.00',
          descricao: 'Placas-mãe (motherboards) para máquinas de processamento de dados',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '35.0',
        },
        {
          ncm: '84733049',
          cest: '21.035.00',
          descricao:
            'Outros circuitos impressos com componentes montados para máquinas da posição 84.71',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '35.0',
        },
        {
          ncm: '84733011',
          cest: '21.035.00',
          descricao: 'Gabinetes com fonte de alimentação para máquinas da posição 84.71',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '35.0',
        },
        {
          ncm: '84733019',
          cest: '21.035.00',
          descricao: 'Outros gabinetes e caixas para máquinas da posição 84.71',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '35.0',
        },
        {
          ncm: '84733031',
          cest: '21.035.00',
          descricao: 'Conjuntos cabeça-disco (HDA) de unidades de discos rígidos, montados',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '35.0',
        },
        {
          ncm: '84733039',
          cest: '21.035.00',
          descricao: 'Outras partes e acessórios de unidades de discos magnéticos ou ópticos',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '35.0',
        },
        {
          ncm: '84733099',
          cest: '21.035.00',
          descricao: 'Outras partes e acessórios de máquinas da posição 84.71',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '35.0',
        },

        // --- COMPUTADORES DESKTOP E UNIDADES DE PROCESSAMENTO ---
        {
          ncm: '84715010',
          cest: '21.030.00',
          descricao:
            'Unidades de processamento digital de pequena capacidade (Desktops/PCs comuns)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '30.0',
        },
        {
          ncm: '84715011',
          cest: '21.030.00',
          descricao:
            'Unidades de processamento digital, de valor FOB inferior ou igual a US$ 12.500',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '30.0',
        },
        {
          ncm: '84715021',
          cest: '21.030.00',
          descricao: 'Unidades de processamento digital de média capacidade',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '30.0',
        },
        {
          ncm: '84715040',
          cest: '21.030.00',
          descricao: 'Unidades de processamento em grande escala / servidores departamentais',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '30.0',
        },
        {
          ncm: '84715090',
          cest: '21.030.00',
          descricao: 'Outras unidades de processamento digital',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '30.0',
        },

        // --- SISTEMAS COMPLETOS INTEGRADOS (8471.41 / 8471.49 -> CEST 21.029.00 / 21.034.00) ---
        {
          ncm: '84714100',
          cest: '21.029.00',
          descricao: 'Computadores que contenham no mesmo corpo CPU, teclado e tela (All-in-One)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '29.0',
        },
        {
          ncm: '84714900',
          cest: '21.029.00',
          descricao:
            'Outras máquinas automáticas para processamento de dados apresentadas sob forma de sistemas',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '29.0',
        },

        // --- ENTRADA E SAÍDA: TECLADOS, MOUSES, LEITORES (8471.60 -> CEST 21.031.00 e 21.032.00) ---
        {
          ncm: '84716052',
          cest: '21.031.00',
          descricao: 'Teclados de computador',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '31.0',
        },
        {
          ncm: '84716053',
          cest: '21.031.00',
          descricao: 'Mouses, trackballs e outros indicadores/apontadores',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '31.0',
        },
        {
          ncm: '84716059',
          cest: '21.031.00',
          descricao: 'Outras unidades de entrada para processamento de dados',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '31.0',
        },
        {
          ncm: '84716090',
          cest: '21.032.00',
          descricao: 'Outras unidades de entrada ou de saída para máquinas da posição 84.71',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '32.0',
        },

        // --- FONTES, CARREGADORES E NO-BREAKS (8504 -> CEST 21.037.00 / 21.038.00) ---
        {
          ncm: '85044010',
          cest: '21.037.00',
          descricao:
            'Carregadores de acumuladores (fontes para notebooks, celulares e periféricos)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '37.0',
        },
        {
          ncm: '85044040',
          cest: '21.038.00',
          descricao: 'Equipamentos de alimentação ininterrupta de energia (UPS ou no-break)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '38.0',
        },
        {
          ncm: '85044021',
          cest: '21.037.00',
          descricao: 'Retificadores de corrente / fontes chaveadas estabilizadas',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '37.0',
        },

        // --- MONITORES E TELAS (8528.51 / 8528.52 / 8528.59 -> CEST 21.067.00 / 21.068.00) ---
        {
          ncm: '85285120',
          cest: '21.068.00',
          descricao: 'Monitores policromáticos para máquinas automáticas de processamento de dados',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '68.0',
        },
        {
          ncm: '85285200',
          cest: '21.068.00',
          descricao:
            'Monitores capazes de ser conectados diretamente a máquina de processamento de dados',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '68.0',
        },
        {
          ncm: '85285920',
          cest: '21.067.00',
          descricao: 'Outros monitores e projetores policromáticos',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '67.0',
        },
        {
          ncm: '85284929',
          cest: '21.067.00',
          descricao: 'Monitores policromáticos de tubo catódico (CRT)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '67.0',
        },

        // --- IMPRESSORAS E MULTIFUNCIONAIS (8443.31 / 8443.32 / 8443.99 -> CEST 21.016.00 / 21.017.00 / 21.018.00) ---
        {
          ncm: '84433111',
          cest: '21.016.00',
          descricao: 'Multifuncionais a laser policromáticas capazes de conectar à rede',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '16.0',
        },
        {
          ncm: '84433115',
          cest: '21.016.00',
          descricao: 'Multifuncionais a jato de tinta capazes de conectar a computador ou rede',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '16.0',
        },
        {
          ncm: '84433223',
          cest: '21.017.00',
          descricao: 'Impressoras térmicas para emissão de cupom fiscal / não-fiscal',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '17.0',
        },
        {
          ncm: '84433231',
          cest: '21.017.00',
          descricao: 'Impressoras de jato de tinta conectáveis a computador/rede',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '17.0',
        },
        {
          ncm: '84433234',
          cest: '21.017.00',
          descricao: 'Impressoras a laser monocromáticas conectáveis a rede',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '17.0',
        },
        {
          ncm: '84433299',
          cest: '21.017.00',
          descricao: 'Outras impressoras conectáveis a computador ou rede',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '17.0',
        },
        {
          ncm: '84439990',
          cest: '21.018.00',
          descricao: 'Partes e acessórios de impressoras e máquinas multifuncionais',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '18.0',
        },

        // --- CARTÕES DE MEMÓRIA E SMART CARDS (8523.51 / 8523.52 -> CEST 21.062.00 / 21.063.00) ---
        {
          ncm: '85235110',
          cest: '21.062.00',
          descricao: 'Cartões de memória (SD Card, MicroSD, CF card)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '62.0',
        },
        {
          ncm: '85235200',
          cest: '21.063.00',
          descricao: 'Cartões inteligentes (smart cards)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '63.0',
        },

        // --- TELEFONIA E CELULARES (8517.12 / 8517.13 / 8517.11 -> CEST 21.053.00 / 21.052.00) ---
        {
          ncm: '85171231',
          cest: '21.053.00',
          descricao: 'Telefones celulares portáteis (smartphones)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '53.0',
        },
        {
          ncm: '85171300',
          cest: '21.053.00',
          descricao: 'Smartphones e telefones celulares de redes móveis (código NCM recente)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '53.0',
        },
        {
          ncm: '85171200',
          cest: '21.053.00',
          descricao: 'Telefones para redes celulares ou para outras redes sem fio',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '53.0',
        },
        {
          ncm: '85171100',
          cest: '21.052.00',
          descricao: 'Aparelhos telefônicos por fio com fone sem fio',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '52.0',
        },

        // --- EQUIPAMENTOS DE REDE E ROTEADORES (8517.62 -> CEST 21.080.00 / 21.083.00 / 21.056.00) ---
        {
          ncm: '85176241',
          cest: '21.083.00',
          descricao: 'Roteadores digitais em redes com ou sem fio',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '83.0',
        },
        {
          ncm: '85176249',
          cest: '21.083.00',
          descricao: 'Outros roteadores digitais',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '83.0',
        },
        {
          ncm: '85176239',
          cest: '21.082.00',
          descricao: 'Switches e aparelhos de comutação para rede de dados',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '82.0',
        },
        {
          ncm: '85176255',
          cest: '21.056.00',
          descricao: 'Modems para transmissão de dados',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '56.0',
        },

        // --- ÁUDIO, FONES DE OUVIDO E CAIXAS DE SOM (8518 -> CEST 21.057.00) ---
        {
          ncm: '85183000',
          cest: '21.057.00',
          descricao: 'Fones de ouvido (auscultadores), mesmo combinados com microfone',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '57.0',
        },
        {
          ncm: '85182100',
          cest: '21.057.00',
          descricao: 'Alto-falantes únicos montados nos seus receptáculos (caixas de som)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '57.0',
        },
        {
          ncm: '85182200',
          cest: '21.057.00',
          descricao: 'Caixas de som com múltiplos alto-falantes montados no mesmo receptáculo',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '57.0',
        },
        {
          ncm: '85181010',
          cest: '21.057.00',
          descricao: 'Microfones e seus suportes',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '57.0',
        },

        // --- CÂMERAS E WEBCAMS (8525.80 / 8525.89 -> CEST 21.065.00) ---
        {
          ncm: '85258019',
          cest: '21.065.00',
          descricao: 'Câmeras fotográficas digitais e câmeras de vídeo (inclusive webcams)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '65.0',
        },
        {
          ncm: '85258919',
          cest: '21.065.00',
          descricao: 'Outras câmeras de vídeo e fotografia digital',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '65.0',
        },

        // --- CONSOLES E VÍDEO GAMES (9504.50 -> CEST 21.079.00) ---
        {
          ncm: '95045000',
          cest: '21.079.00',
          descricao: 'Consoles e máquinas de jogos de vídeo (videogames)',
          segmento: '21 - Produtos eletrônicos, eletroeletrônicos e eletrodomésticos',
          item_anexo: '79.0',
        },
      ]

      for (const item of seedItems) {
        const record = new Record(ncmCest)
        record.set('ncm', item.ncm)
        record.set('cest', item.cest)
        record.set('descricao', item.descricao)
        record.set('segmento', item.segmento)
        record.set('item_anexo', item.item_anexo)
        app.save(record)
      }
      console.log(
        `[0484] ${seedItems.length} registros NCM->CEST oficiais semeados na tabela ncm_cest`,
      )
    }
  },
  (app) => {
    try {
      const coll = app.findCollectionByNameOrId('ncm_cest')
      if (coll) app.delete(coll)
    } catch (_) {}
  },
)
