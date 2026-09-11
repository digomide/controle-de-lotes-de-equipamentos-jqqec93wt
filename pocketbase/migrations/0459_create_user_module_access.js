/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const AUTH_ALL = "@request.auth.id != ''"
    const ADMIN_OR_SELF =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.id = user_id)"
    const ADMIN_ONLY = "@request.auth.id != '' && @request.auth.role = 'admin'"

    // 1. Criar coleção user_module_access
    if (!app.hasTable('user_module_access')) {
      const usersColRecord = app.findCollectionByNameOrId('users')

      const accessCollection = new Collection({
        name: 'user_module_access',
        type: 'base',
        listRule: ADMIN_OR_SELF,
        viewRule: ADMIN_OR_SELF,
        createRule: ADMIN_ONLY,
        updateRule: ADMIN_ONLY,
        deleteRule: ADMIN_ONLY,
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: usersColRecord.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'modules',
            type: 'json',
            required: true,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_user_module_access_user ON user_module_access (user_id)',
        ],
      })

      app.save(accessCollection)
      console.log('[0459] Coleção user_module_access criada com sucesso')
    }

    // 2. Todos os módulos canônicos do sistema
    const ALL_MODULES = [
      'dashboard',
      'lotes_compra',
      'lucratividade',
      'explorador_catalogo',
      'gestor_ml',
      'produtos',
      'marketing',
      'radar_ml',
      'post_instagram',
      'post_tiktok',
      'cotacoes',
      'vendas',
      'estoque_geral',
      'estoque_lotes',
      'ajustes',
      'usuarios',
      'configuracoes',
    ]

    // Pacote padrão do operador member: apenas Dashboard e Vendas (sem ajuste de estoque nem configs)
    const MEMBER_DEFAULT_MODULES = ['dashboard', 'vendas']

    // 3. Seed de permissões para os usuários existentes
    try {
      const accessCol = app.findCollectionByNameOrId('user_module_access')
      const allUsers = app.findRecordsByFilter('users', '1=1', '', 0, 0)

      for (let i = 0; i < allUsers.length; i++) {
        const u = allUsers[i]
        const role = u.getString('role')
        const email = u.getString('email').toLowerCase()
        const isAdmin =
          role === 'admin' || email === 'rodrigoifgx@gmail.com' || email.includes('gomide')

        // Verificar se já possui registro de acesso
        let existingAccess = null
        try {
          existingAccess = app.findFirstRecordByFilter('user_module_access', `user_id = '${u.id}'`)
        } catch (_) {}

        const modulesToAssign = isAdmin ? ALL_MODULES : MEMBER_DEFAULT_MODULES

        if (!existingAccess) {
          const rec = new Record(accessCol)
          rec.set('user_id', u.id)
          rec.set('modules', modulesToAssign)
          app.save(rec)
          console.log(
            `[0459] Seed de módulos criado para ${email} (${isAdmin ? 'ADMIN: todos' : 'MEMBER: dashboard+vendas'})`,
          )
        } else {
          // Atualizar se for admin para garantir todos os módulos
          if (isAdmin) {
            existingAccess.set('modules', ALL_MODULES)
            app.save(existingAccess)
          }
        }
      }
    } catch (seedErr) {
      console.log('[0459] Aviso ao rodar seed de permissões: ' + seedErr)
    }
  },
  (app) => {
    try {
      const accessCol = app.findCollectionByNameOrId('user_module_access')
      if (accessCol) app.delete(accessCol)
    } catch (_) {}
  },
)
