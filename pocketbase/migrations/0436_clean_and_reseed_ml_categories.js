migrate(
  (app) => {
    // 0436: Limpar registros vazios e popular árvore inicial de categorias
    try {
      app
        .db()
        .newQuery("DELETE FROM ml_categories WHERE category_id = '' OR category_id IS NULL")
        .execute()
    } catch (_) {}

    const col = app.findCollectionByNameOrId('ml_categories')
    if (!col) return

    const initialCategories = [
      // 1. Informática (MLB1648)
      {
        id: 'MLB1648',
        name: 'Informática',
        parent_id: '',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: '',
        subfamily_name: '',
        full_path: 'Informática',
        level: 1,
      },
      {
        id: 'MLB430687',
        name: 'Portáteis e Acessórios (Notebooks/Tablets)',
        parent_id: 'MLB1648',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB430687',
        subfamily_name: 'Portáteis e Acessórios',
        full_path: 'Informática > Portáteis e Acessórios',
        level: 2,
      },
      {
        id: 'MLB1652',
        name: 'Notebooks',
        parent_id: 'MLB430687',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB430687',
        subfamily_name: 'Notebooks',
        full_path: 'Informática > Portáteis e Acessórios > Notebooks',
        level: 3,
      },
      {
        id: 'MLB9439',
        name: 'Peças e Partes para Notebooks',
        parent_id: 'MLB430687',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB430687',
        subfamily_name: 'Peças para Notebooks',
        full_path: 'Informática > Portáteis e Acessórios > Peças e Partes para Notebooks',
        level: 3,
      },
      {
        id: 'MLB38702',
        name: 'Placas Mãe para Notebook',
        parent_id: 'MLB9439',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB430687',
        subfamily_name: 'Peças para Notebooks',
        full_path: 'Informática > Peças para Notebooks > Placas Mãe',
        level: 4,
        is_leaf: true,
      },
      {
        id: 'MLB1649',
        name: 'Computadores e Servidores (Desktops)',
        parent_id: 'MLB1648',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB1649',
        subfamily_name: 'Desktops e Servidores',
        full_path: 'Informática > Computadores e Servidores',
        level: 2,
      },
      {
        id: 'MLB1650',
        name: 'Desktops / PCs de Mesa',
        parent_id: 'MLB1649',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB1649',
        subfamily_name: 'Desktops e Servidores',
        full_path: 'Informática > Computadores e Servidores > Computadores',
        level: 3,
      },
      {
        id: 'MLB1653',
        name: 'Componentes para PC (Hardware)',
        parent_id: 'MLB1648',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB1653',
        subfamily_name: 'Componentes para PC',
        full_path: 'Informática > Componentes para PC',
        level: 2,
      },
      {
        id: 'MLB4090',
        name: 'Placas-Mãe Desktop',
        parent_id: 'MLB1653',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB1653',
        subfamily_name: 'Componentes para PC',
        full_path: 'Informática > Componentes para PC > Placas-Mãe',
        level: 3,
        is_leaf: true,
      },
      {
        id: 'MLB1658',
        name: 'Memórias RAM',
        parent_id: 'MLB1653',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB1653',
        subfamily_name: 'Componentes para PC',
        full_path: 'Informática > Componentes para PC > Memórias RAM',
        level: 3,
        is_leaf: true,
      },
      {
        id: 'MLB1672',
        name: 'Discos Rígidos e SSDs',
        parent_id: 'MLB1653',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB1653',
        subfamily_name: 'Componentes para PC',
        full_path: 'Informática > Componentes para PC > Discos Rígidos e SSDs',
        level: 3,
        is_leaf: true,
      },
      {
        id: 'MLB1694',
        name: 'Fontes de Alimentação',
        parent_id: 'MLB1653',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB1653',
        subfamily_name: 'Componentes para PC',
        full_path: 'Informática > Componentes para PC > Fontes de Alimentação',
        level: 3,
        is_leaf: true,
      },
      {
        id: 'MLB1664',
        name: 'Processadores',
        parent_id: 'MLB1653',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB1653',
        subfamily_name: 'Componentes para PC',
        full_path: 'Informática > Componentes para PC > Processadores',
        level: 3,
        is_leaf: true,
      },
      {
        id: 'MLB1654',
        name: 'Placas de Vídeo',
        parent_id: 'MLB1653',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB1653',
        subfamily_name: 'Componentes para PC',
        full_path: 'Informática > Componentes para PC > Placas de Vídeo',
        level: 3,
        is_leaf: true,
      },
      {
        id: 'MLB14407',
        name: 'Monitores e Acessórios',
        parent_id: 'MLB1648',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB14407',
        subfamily_name: 'Monitores e Acessórios',
        full_path: 'Informática > Monitores e Acessórios',
        level: 2,
      },
      {
        id: 'MLB14412',
        name: 'Monitores',
        parent_id: 'MLB14407',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB14407',
        subfamily_name: 'Monitores e Acessórios',
        full_path: 'Informática > Monitores e Acessórios > Monitores',
        level: 3,
        is_leaf: true,
      },
      {
        id: 'MLB82067',
        name: 'Tablets e Acessórios',
        parent_id: 'MLB1648',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB82067',
        subfamily_name: 'Tablets e Acessórios',
        full_path: 'Informática > Tablets e Acessórios',
        level: 2,
      },
      {
        id: 'MLB82069',
        name: 'Tablets',
        parent_id: 'MLB82067',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB82067',
        subfamily_name: 'Tablets e Acessórios',
        full_path: 'Informática > Tablets e Acessórios > Tablets',
        level: 3,
        is_leaf: true,
      },
      {
        id: 'MLB1676',
        name: 'Impressão',
        parent_id: 'MLB1648',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB1676',
        subfamily_name: 'Impressão',
        full_path: 'Informática > Impressão',
        level: 2,
      },
      {
        id: 'MLB1677',
        name: 'Impressoras e Multifuncionais',
        parent_id: 'MLB1676',
        family_id: 'MLB1648',
        family_name: 'Informática',
        subfamily_id: 'MLB1676',
        subfamily_name: 'Impressão',
        full_path: 'Informática > Impressão > Impressoras e Multifuncionais',
        level: 3,
        is_leaf: true,
      },

      // 2. Celulares e Telefones (MLB105188)
      {
        id: 'MLB105188',
        name: 'Celulares e Telefones',
        parent_id: '',
        family_id: 'MLB105188',
        family_name: 'Celulares e Telefones',
        subfamily_id: '',
        subfamily_name: '',
        full_path: 'Celulares e Telefones',
        level: 1,
      },
      {
        id: 'MLB1055',
        name: 'Celulares e Smartphones',
        parent_id: 'MLB105188',
        family_id: 'MLB105188',
        family_name: 'Celulares e Telefones',
        subfamily_id: 'MLB1055',
        subfamily_name: 'Celulares e Smartphones',
        full_path: 'Celulares e Telefones > Celulares e Smartphones',
        level: 2,
        is_leaf: true,
      },
      {
        id: 'MLB3813',
        name: 'Peças para Celular',
        parent_id: 'MLB105188',
        family_id: 'MLB105188',
        family_name: 'Celulares e Telefones',
        subfamily_id: 'MLB3813',
        subfamily_name: 'Peças para Celular',
        full_path: 'Celulares e Telefones > Peças para Celular',
        level: 2,
      },
      {
        id: 'MLB9113',
        name: 'Telas e Displays',
        parent_id: 'MLB3813',
        family_id: 'MLB105188',
        family_name: 'Celulares e Telefones',
        subfamily_id: 'MLB3813',
        subfamily_name: 'Peças para Celular',
        full_path: 'Celulares e Telefones > Peças para Celular > Displays e Telas',
        level: 3,
        is_leaf: true,
      },
      {
        id: 'MLB3814',
        name: 'Baterias para Celular',
        parent_id: 'MLB3813',
        family_id: 'MLB105188',
        family_name: 'Celulares e Telefones',
        subfamily_id: 'MLB3813',
        subfamily_name: 'Peças para Celular',
        full_path: 'Celulares e Telefones > Peças para Celular > Baterias',
        level: 3,
        is_leaf: true,
      },

      // 3. Eletrônicos, Áudio e Vídeo (MLB1000)
      {
        id: 'MLB1000',
        name: 'Eletrônicos, Áudio e Vídeo',
        parent_id: '',
        family_id: 'MLB1000',
        family_name: 'Eletrônicos, Áudio e Vídeo',
        subfamily_id: '',
        subfamily_name: '',
        full_path: 'Eletrônicos, Áudio e Vídeo',
        level: 1,
      },
      {
        id: 'MLB1002',
        name: 'Televisores e Smart TVs',
        parent_id: 'MLB1000',
        family_id: 'MLB1000',
        family_name: 'Eletrônicos, Áudio e Vídeo',
        subfamily_id: 'MLB1002',
        subfamily_name: 'Televisores',
        full_path: 'Eletrônicos, Áudio e Vídeo > Televisores',
        level: 2,
        is_leaf: true,
      },
      {
        id: 'MLB3697',
        name: 'Áudio para Casa e Som',
        parent_id: 'MLB1000',
        family_id: 'MLB1000',
        family_name: 'Eletrônicos, Áudio e Vídeo',
        subfamily_id: 'MLB3697',
        subfamily_name: 'Áudio',
        full_path: 'Eletrônicos, Áudio e Vídeo > Áudio',
        level: 2,
      },

      // 4. Games e Consoles (MLB1144)
      {
        id: 'MLB1144',
        name: 'Games e Consoles',
        parent_id: '',
        family_id: 'MLB1144',
        family_name: 'Games e Consoles',
        subfamily_id: '',
        subfamily_name: '',
        full_path: 'Games e Consoles',
        level: 1,
      },
      {
        id: 'MLB1145',
        name: 'Consoles e Videogames',
        parent_id: 'MLB1144',
        family_id: 'MLB1144',
        family_name: 'Games e Consoles',
        subfamily_id: 'MLB1145',
        subfamily_name: 'Consoles',
        full_path: 'Games e Consoles > Consoles',
        level: 2,
        is_leaf: true,
      },
      {
        id: 'MLB1146',
        name: 'Jogos e Acessórios para Videogames',
        parent_id: 'MLB1144',
        family_id: 'MLB1144',
        family_name: 'Games e Consoles',
        subfamily_id: 'MLB1146',
        subfamily_name: 'Acessórios',
        full_path: 'Games e Consoles > Acessórios',
        level: 2,
      },
    ]

    for (let i = 0; i < initialCategories.length; i++) {
      const c = initialCategories[i]
      try {
        let rec = null
        try {
          rec = app.findFirstRecordByData('ml_categories', 'category_id', c.id)
        } catch (_) {}

        if (!rec) {
          rec = new Record(col)
          rec.set('category_id', c.id)
        }
        rec.set('name', c.name)
        rec.set('parent_id', c.parent_id || '')
        rec.set('family_id', c.family_id || '')
        rec.set('family_name', c.family_name || '')
        rec.set('subfamily_id', c.subfamily_id || '')
        rec.set('subfamily_name', c.subfamily_name || '')
        rec.set('full_path', c.full_path || c.name)
        rec.set('level', c.level || 1)
        rec.set('is_leaf', Boolean(c.is_leaf))
        app.save(rec)
      } catch (eSave) {
        console.warn('Erro ao popular categoria ' + c.id + ': ' + eSave)
      }
    }
  },
  () => {},
)
