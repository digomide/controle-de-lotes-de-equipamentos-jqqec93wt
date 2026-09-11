// Hook administrativo para gestão avançada de usuários, permissões de módulos e proteção de acesso
// Tudo inline dentro de cada callback para respeitar a VM isolada do PocketBase v0.36 (Goja engine)

// Interceptar login com senha para bloquear usuários inativos
try {
  onRecordAuthWithPasswordRequest((e) => {
    var rec = e.record
    if (rec && rec.collection().name === 'users') {
      var isActive = rec.getBool('active')
      // Se explicitamente false, bloquear autenticação
      if (isActive === false) {
        if (typeof ApiError === 'function') {
          throw new ApiError(403, 'Esta conta de usuário foi desativada pelo administrador.')
        }
        var err = new Error('Esta conta de usuário foi desativada pelo administrador.')
        err.status = 403
        throw err
      }
    }
    return e.next()
  }, 'users')
} catch (err) {
  console.log('[users_admin_hook] Aviso ao registrar onRecordAuthWithPasswordRequest: ' + err)
}

// Interceptar mutações sensíveis no servidor para verificar privilégios/módulos
// 1. inventory_adjustments create: apenas quem tem permissão para módulo "ajustes" (ou admin)
try {
  onRecordCreateRequest((e) => {
    var authRecord = e.auth
    if (!authRecord) {
      try {
        authRecord = e.requestInfo().auth
      } catch (_) {}
    }
    if (!authRecord || !authRecord.id) {
      return e.next()
    }
    var role = authRecord.getString ? authRecord.getString('role') : authRecord.role
    var email = (
      authRecord.getString ? authRecord.getString('email') : authRecord.email || ''
    ).toLowerCase()
    var isAdmin =
      role === 'admin' || email === 'rodrigoifgx@gmail.com' || email.indexOf('gomide') !== -1
    if (isAdmin) {
      return e.next()
    }

    // Verificar se tem módulo "ajustes"
    try {
      var accessRec = $app.findFirstRecordByFilter(
        'user_module_access',
        "user_id = '" + authRecord.id + "'",
      )
      if (accessRec) {
        var mods = accessRec.get('modules') || []
        var modsList = Array.isArray(mods) ? mods : JSON.parse(mods || '[]')
        if (modsList.indexOf('ajustes') !== -1) {
          return e.next()
        }
      }
    } catch (_) {}

    if (typeof ApiError === 'function') {
      throw new ApiError(
        403,
        'Acesso negado: seu usuário não possui permissão para o módulo de Ajustes.',
      )
    }
    var blockErr = new Error(
      'Acesso negado: seu usuário não possui permissão para o módulo de Ajustes.',
    )
    blockErr.status = 403
    throw blockErr
  }, 'inventory_adjustments')
} catch (err) {
  console.log('[users_admin_hook] Aviso ao registrar interceptor de inventory_adjustments: ' + err)
}

// 2. general_inventory_movements create (ajustes): verificar permissão de módulo estoque_geral ou ajustes
try {
  onRecordCreateRequest((e) => {
    var authRecord = e.auth
    if (!authRecord) {
      try {
        authRecord = e.requestInfo().auth
      } catch (_) {}
    }
    if (!authRecord || !authRecord.id) {
      return e.next()
    }
    var role = authRecord.getString ? authRecord.getString('role') : authRecord.role
    var email = (
      authRecord.getString ? authRecord.getString('email') : authRecord.email || ''
    ).toLowerCase()
    var isAdmin =
      role === 'admin' || email === 'rodrigoifgx@gmail.com' || email.indexOf('gomide') !== -1
    if (isAdmin) {
      return e.next()
    }

    try {
      var accessRec = $app.findFirstRecordByFilter(
        'user_module_access',
        "user_id = '" + authRecord.id + "'",
      )
      if (accessRec) {
        var mods = accessRec.get('modules') || []
        var modsList = Array.isArray(mods) ? mods : JSON.parse(mods || '[]')
        if (modsList.indexOf('estoque_geral') !== -1 || modsList.indexOf('ajustes') !== -1) {
          return e.next()
        }
      }
    } catch (_) {}

    if (typeof ApiError === 'function') {
      throw new ApiError(
        403,
        'Acesso negado: seu usuário não possui permissão para movimentar Estoque Geral.',
      )
    }
    var blockErr = new Error(
      'Acesso negado: seu usuário não possui permissão para movimentar Estoque Geral.',
    )
    blockErr.status = 403
    throw blockErr
  }, 'general_inventory_movements')
} catch (err) {
  console.log(
    '[users_admin_hook] Aviso ao registrar interceptor de general_inventory_movements: ' + err,
  )
}

// Rota para resetar senha de um usuário (gerar senha provisória e aplicar via servidor)
routerAdd('POST', '/backend/v1/users/reset-password', (e) => {
  var authRecord = e.auth
  if (!authRecord) {
    try {
      var info = e.requestInfo()
      authRecord = info.auth
    } catch (_) {}
  }

  if (!authRecord || !authRecord.id) {
    return e.json(401, { ok: false, error: 'Sessão não autenticada.' })
  }

  var currentRole = authRecord.getString ? authRecord.getString('role') : authRecord.role
  var currentEmail = authRecord.getString ? authRecord.getString('email') : authRecord.email
  if (currentRole !== 'admin' && currentEmail !== 'rodrigoifgx@gmail.com') {
    return e.json(403, {
      ok: false,
      error: 'Acesso negado. Apenas administradores podem gerenciar usuários.',
    })
  }

  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (err) {
    body = {}
  }

  var userId = (body.userId || body.user_id || body.id || '').toString().trim()
  if (!userId) {
    return e.json(400, { ok: false, error: 'ID do usuário é obrigatório.' })
  }

  try {
    var userRecord = $app.findRecordById('users', userId)
    if (!userRecord) {
      return e.json(404, { ok: false, error: 'Usuário não encontrado.' })
    }

    // Gerar senha provisória segura (ex: Flow#9a8b7c42)
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    var randomPart = ''
    for (var i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    var tempPassword = 'Flow#' + randomPart + (Math.floor(Math.random() * 90) + 10)

    userRecord.setPassword(tempPassword)
    $app.save(userRecord)

    console.log(
      '[users_admin_hook] Senha provisória gerada para usuário ' +
        userRecord.getString('email') +
        ' por admin ' +
        currentEmail,
    )

    return e.json(200, {
      ok: true,
      message: 'Senha resetada com sucesso.',
      userId: userRecord.id,
      email: userRecord.getString('email'),
      temporaryPassword: tempPassword,
    })
  } catch (err) {
    console.log('[users_admin_hook] Erro ao resetar senha: ' + err)
    return e.json(500, {
      ok: false,
      error: 'Erro ao resetar senha no banco de dados: ' + (err.message || err),
    })
  }
})

// Rota para criar novo usuário com módulos configurados
routerAdd('POST', '/backend/v1/users/create', (e) => {
  var canonicalModules = [
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

  var authRecord = e.auth
  if (!authRecord) {
    try {
      var info = e.requestInfo()
      authRecord = info.auth
    } catch (_) {}
  }

  if (!authRecord || !authRecord.id) {
    return e.json(401, { ok: false, error: 'Sessão não autenticada.' })
  }

  var currentRole = authRecord.getString ? authRecord.getString('role') : authRecord.role
  var currentEmail = authRecord.getString ? authRecord.getString('email') : authRecord.email
  if (currentRole !== 'admin' && currentEmail !== 'rodrigoifgx@gmail.com') {
    return e.json(403, {
      ok: false,
      error: 'Acesso negado. Apenas administradores podem gerenciar usuários.',
    })
  }

  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (err) {
    body = {}
  }

  var name = (body.name || '').toString().trim()
  var email = (body.email || '').toString().trim().toLowerCase()
  var password = (body.password || '').toString()
  var role = (body.role || 'member').toString().toLowerCase()
  var rawModules = body.modules

  if (!email || !email.includes('@')) {
    return e.json(400, { ok: false, error: 'E-mail inválido ou não informado.' })
  }

  if (!password || password.length < 8) {
    return e.json(400, { ok: false, error: 'A senha provisória deve ter no mínimo 8 caracteres.' })
  }

  if (role !== 'admin' && role !== 'member') {
    role = 'member'
  }

  try {
    // Verificar duplicidade de e-mail
    try {
      var existing = $app.findAuthRecordByEmail('users', email)
      if (existing) {
        return e.json(400, { ok: false, error: 'Já existe um usuário cadastrado com este e-mail.' })
      }
    } catch (_) {}

    var usersCol = $app.findCollectionByNameOrId('users')
    var newRecord = new Record(usersCol)
    newRecord.set('name', name || email.split('@')[0])
    newRecord.set('email', email)
    newRecord.set('role', role)
    newRecord.set('active', true)
    newRecord.set('verified', true)
    newRecord.setPassword(password)

    $app.save(newRecord)

    // Determinar módulos
    var modulesToSet = []
    if (role === 'admin') {
      modulesToSet = canonicalModules
    } else if (Array.isArray(rawModules)) {
      modulesToSet = rawModules
    } else {
      modulesToSet = ['dashboard', 'vendas']
    }

    // Gravar registro em user_module_access
    try {
      var accessCol = $app.findCollectionByNameOrId('user_module_access')
      var accessRec = new Record(accessCol)
      accessRec.set('user_id', newRecord.id)
      accessRec.set('modules', modulesToSet)
      $app.save(accessRec)
    } catch (accErr) {
      console.log(
        '[users_admin_hook] Aviso ao criar user_module_access para novo usuário: ' + accErr,
      )
    }

    console.log(
      '[users_admin_hook] Novo usuário criado: ' +
        email +
        ' (papel: ' +
        role +
        ') com ' +
        modulesToSet.length +
        ' módulos por admin ' +
        currentEmail,
    )

    return e.json(200, {
      ok: true,
      message: 'Usuário criado com sucesso.',
      user: {
        id: newRecord.id,
        name: newRecord.getString('name'),
        email: newRecord.getString('email'),
        role: newRecord.getString('role'),
        active: newRecord.getBool('active'),
        created: newRecord.getString('created'),
        modules: modulesToSet,
      },
    })
  } catch (err) {
    console.log('[users_admin_hook] Erro ao criar usuário: ' + err)
    return e.json(500, {
      ok: false,
      error: 'Erro ao cadastrar usuário: ' + (err.message || err),
    })
  }
})

// Rota para atualizar usuário, incluindo papel, status e módulos liberados
routerAdd('POST', '/backend/v1/users/update', (e) => {
  var canonicalModules = [
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

  var authRecord = e.auth
  if (!authRecord) {
    try {
      var info = e.requestInfo()
      authRecord = info.auth
    } catch (_) {}
  }

  if (!authRecord || !authRecord.id) {
    return e.json(401, { ok: false, error: 'Sessão não autenticada.' })
  }

  var currentAdminId = authRecord.id
  var currentRole = authRecord.getString ? authRecord.getString('role') : authRecord.role
  var currentEmail = authRecord.getString ? authRecord.getString('email') : authRecord.email
  if (currentRole !== 'admin' && currentEmail !== 'rodrigoifgx@gmail.com') {
    return e.json(403, {
      ok: false,
      error: 'Acesso negado. Apenas administradores podem gerenciar usuários.',
    })
  }

  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (err) {
    body = {}
  }

  var userId = (body.userId || body.user_id || body.id || '').toString().trim()
  if (!userId) {
    return e.json(400, { ok: false, error: 'ID do usuário é obrigatório.' })
  }

  try {
    var targetUser = $app.findRecordById('users', userId)
    if (!targetUser) {
      return e.json(404, { ok: false, error: 'Usuário não encontrado.' })
    }

    var isSelf = targetUser.id === currentAdminId

    // Proteção contra lockout do próprio administrador
    if (isSelf && body.active === false) {
      return e.json(400, {
        ok: false,
        error: 'Você não pode desativar a sua própria conta de administrador.',
      })
    }

    if (isSelf && body.role && body.role !== 'admin') {
      return e.json(400, {
        ok: false,
        error: 'Você não pode remover o seu próprio papel de administrador.',
      })
    }

    // Proteção para não remover o último administrador do sistema
    if (body.active === false || (body.role && body.role !== 'admin')) {
      if (targetUser.getString('role') === 'admin') {
        var otherAdmins = $app.findRecordsByFilter(
          'users',
          "role = 'admin' && active = true && id != '" + targetUser.id + "'",
          '',
          0,
          0,
        )
        if (!otherAdmins || otherAdmins.length === 0) {
          return e.json(400, {
            ok: false,
            error:
              'Operação bloqueada: não é permitido desativar ou rebaixar o único administrador ativo do sistema.',
          })
        }
      }
    }

    if (body.name !== undefined) {
      targetUser.set('name', String(body.name).trim())
    }

    var newRole = targetUser.getString('role')
    if (body.role !== undefined) {
      var targetRole = String(body.role).toLowerCase()
      if (targetRole === 'admin' || targetRole === 'member') {
        targetUser.set('role', targetRole)
        newRole = targetRole
      }
    }

    if (body.active !== undefined) {
      targetUser.set('active', Boolean(body.active))
    }

    $app.save(targetUser)

    // Atualizar módulos em user_module_access
    var updatedModules = []
    try {
      var accessCol = $app.findCollectionByNameOrId('user_module_access')
      var accessRec = null
      try {
        accessRec = $app.findFirstRecordByFilter(
          'user_module_access',
          "user_id = '" + targetUser.id + "'",
        )
      } catch (_) {}

      if (newRole === 'admin') {
        // Admins sempre têm todos os módulos
        updatedModules = canonicalModules
      } else if (Array.isArray(body.modules)) {
        updatedModules = body.modules
      } else if (accessRec) {
        var existingMods = accessRec.get('modules')
        updatedModules = Array.isArray(existingMods)
          ? existingMods
          : JSON.parse(existingMods || '[]')
      } else {
        updatedModules = ['dashboard', 'vendas']
      }

      if (!accessRec) {
        accessRec = new Record(accessCol)
        accessRec.set('user_id', targetUser.id)
      }
      accessRec.set('modules', updatedModules)
      $app.save(accessRec)
    } catch (modErr) {
      console.log('[users_admin_hook] Aviso ao atualizar user_module_access: ' + modErr)
    }

    console.log(
      '[users_admin_hook] Usuário atualizado ' +
        targetUser.getString('email') +
        ' por admin ' +
        currentEmail,
    )

    return e.json(200, {
      ok: true,
      message: 'Usuário atualizado com sucesso.',
      user: {
        id: targetUser.id,
        name: targetUser.getString('name'),
        email: targetUser.getString('email'),
        role: targetUser.getString('role'),
        active: targetUser.getBool('active'),
        updated: targetUser.getString('updated'),
        modules: updatedModules,
      },
    })
  } catch (err) {
    console.log('[users_admin_hook] Erro ao atualizar usuário: ' + err)
    return e.json(500, {
      ok: false,
      error: 'Erro ao atualizar usuário: ' + (err.message || err),
    })
  }
})

// Rota para listar todos os usuários juntamente com seus módulos liberados
routerAdd('GET', '/backend/v1/users/list-with-access', (e) => {
  var canonicalModules = [
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

  var authRecord = e.auth
  if (!authRecord) {
    try {
      var info = e.requestInfo()
      authRecord = info.auth
    } catch (_) {}
  }

  if (!authRecord || !authRecord.id) {
    return e.json(401, { ok: false, error: 'Sessão não autenticada.' })
  }

  var currentRole = authRecord.getString ? authRecord.getString('role') : authRecord.role
  var currentEmail = authRecord.getString ? authRecord.getString('email') : authRecord.email
  if (currentRole !== 'admin' && currentEmail !== 'rodrigoifgx@gmail.com') {
    return e.json(403, {
      ok: false,
      error: 'Acesso negado. Apenas administradores podem visualizar acessos de usuários.',
    })
  }

  try {
    var allUsers = $app.findRecordsByFilter('users', '1=1', '-created', 0, 0)
    var allAccess = $app.findRecordsByFilter('user_module_access', '1=1', '', 0, 0)

    var accessMap = {}
    for (var i = 0; i < allAccess.length; i++) {
      var acc = allAccess[i]
      var uId = acc.getString('user_id')
      var m = acc.get('modules')
      accessMap[uId] = Array.isArray(m) ? m : JSON.parse(m || '[]')
    }

    var result = []
    for (var j = 0; j < allUsers.length; j++) {
      var u = allUsers[j]
      var uRole = u.getString('role')
      var isAdm = uRole === 'admin'
      var userModules = isAdm ? canonicalModules : accessMap[u.id] || ['dashboard', 'vendas']

      result.push({
        id: u.id,
        name: u.getString('name'),
        email: u.getString('email'),
        role: uRole,
        active: u.getBool('active'),
        created: u.getString('created'),
        updated: u.getString('updated'),
        modules: userModules,
      })
    }

    return e.json(200, { ok: true, users: result })
  } catch (err) {
    console.log('[users_admin_hook] Erro ao listar usuários com acesso: ' + err)
    return e.json(500, { ok: false, error: 'Erro ao listar usuários: ' + (err.message || err) })
  }
})

// Rota para obter os módulos do usuário autenticado no momento (refresh/login)
routerAdd('GET', '/backend/v1/users/my-access', (e) => {
  var canonicalModules = [
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

  var authRecord = e.auth
  if (!authRecord) {
    try {
      var info = e.requestInfo()
      authRecord = info.auth
    } catch (_) {}
  }

  if (!authRecord || !authRecord.id) {
    return e.json(401, { ok: false, error: 'Sessão não autenticada.' })
  }

  var currentRole = authRecord.getString ? authRecord.getString('role') : authRecord.role
  var currentEmail = (
    authRecord.getString ? authRecord.getString('email') : authRecord.email || ''
  ).toLowerCase()
  var isAdmin =
    currentRole === 'admin' ||
    currentEmail === 'rodrigoifgx@gmail.com' ||
    currentEmail.indexOf('gomide') !== -1

  if (isAdmin) {
    return e.json(200, {
      ok: true,
      isAdmin: true,
      modules: canonicalModules,
    })
  }

  try {
    var accessRec = $app.findFirstRecordByFilter(
      'user_module_access',
      "user_id = '" + authRecord.id + "'",
    )
    var mods = accessRec ? accessRec.get('modules') : ['dashboard', 'vendas']
    var modsList = Array.isArray(mods) ? mods : JSON.parse(mods || '[]')
    return e.json(200, {
      ok: true,
      isAdmin: false,
      modules: modsList,
    })
  } catch (_) {
    return e.json(200, {
      ok: true,
      isAdmin: false,
      modules: ['dashboard', 'vendas'],
    })
  }
})

// Rota para salvar permissões de módulos de um usuário específico
routerAdd('POST', '/backend/v1/users/save-access', (e) => {
  var canonicalModules = [
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

  var authRecord = e.auth
  if (!authRecord) {
    try {
      var info = e.requestInfo()
      authRecord = info.auth
    } catch (_) {}
  }

  if (!authRecord || !authRecord.id) {
    return e.json(401, { ok: false, error: 'Sessão não autenticada.' })
  }

  var currentRole = authRecord.getString ? authRecord.getString('role') : authRecord.role
  var currentEmail = authRecord.getString ? authRecord.getString('email') : authRecord.email
  if (currentRole !== 'admin' && currentEmail !== 'rodrigoifgx@gmail.com') {
    return e.json(403, {
      ok: false,
      error: 'Acesso negado. Apenas administradores podem gerenciar permissões.',
    })
  }

  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (err) {
    body = {}
  }

  var userId = (body.userId || body.user_id || body.id || '').toString().trim()
  var modules = body.modules
  if (!userId) {
    return e.json(400, { ok: false, error: 'ID do usuário é obrigatório.' })
  }
  if (!Array.isArray(modules)) {
    return e.json(400, { ok: false, error: 'Lista de módulos deve ser um array.' })
  }

  try {
    var targetUser = $app.findRecordById('users', userId)
    if (!targetUser) {
      return e.json(404, { ok: false, error: 'Usuário não encontrado.' })
    }

    var targetRole = targetUser.getString('role')
    // Se o usuário for admin, ele tem sempre todos os módulos
    var modulesToSave = targetRole === 'admin' ? canonicalModules : modules

    var accessCol = $app.findCollectionByNameOrId('user_module_access')
    var accessRec = null
    try {
      accessRec = $app.findFirstRecordByFilter(
        'user_module_access',
        "user_id = '" + targetUser.id + "'",
      )
    } catch (_) {}

    if (!accessRec) {
      accessRec = new Record(accessCol)
      accessRec.set('user_id', targetUser.id)
    }
    accessRec.set('modules', modulesToSave)
    $app.save(accessRec)

    console.log(
      '[users_admin_hook] Módulos atualizados para ' +
        targetUser.getString('email') +
        ' por admin ' +
        currentEmail +
        ': ' +
        JSON.stringify(modulesToSave),
    )

    return e.json(200, {
      ok: true,
      message: 'Permissões atualizadas com sucesso.',
      userId: targetUser.id,
      modules: modulesToSave,
    })
  } catch (err) {
    console.log('[users_admin_hook] Erro ao salvar acessos: ' + err)
    return e.json(500, { ok: false, error: 'Erro ao salvar acessos: ' + (err.message || err) })
  }
})

// Rota para excluir usuário com proteção contra auto-exclusão e último admin
routerAdd('DELETE', '/backend/v1/users/delete', (e) => {
  var authRecord = e.auth
  if (!authRecord) {
    try {
      var info = e.requestInfo()
      authRecord = info.auth
    } catch (_) {}
  }

  if (!authRecord || !authRecord.id) {
    return e.json(401, { ok: false, error: 'Sessão não autenticada.' })
  }

  var currentAdminId = authRecord.id
  var currentRole = authRecord.getString ? authRecord.getString('role') : authRecord.role
  var currentEmail = authRecord.getString ? authRecord.getString('email') : authRecord.email
  if (currentRole !== 'admin' && currentEmail !== 'rodrigoifgx@gmail.com') {
    return e.json(403, {
      ok: false,
      error: 'Acesso negado. Apenas administradores podem gerenciar usuários.',
    })
  }

  var reqInfo = e.requestInfo ? e.requestInfo() : null
  var query = (reqInfo && reqInfo.query) || {}
  var body = (reqInfo && reqInfo.body) || {}

  var userId = (query.id || query.userId || body.userId || body.id || '').toString().trim()
  if (!userId) {
    return e.json(400, { ok: false, error: 'ID do usuário é obrigatório.' })
  }

  if (userId === currentAdminId) {
    return e.json(400, {
      ok: false,
      error: 'Você não pode excluir a sua própria conta de administrador.',
    })
  }

  try {
    var targetUser = $app.findRecordById('users', userId)
    if (!targetUser) {
      return e.json(404, { ok: false, error: 'Usuário não encontrado.' })
    }

    if (targetUser.getString('role') === 'admin') {
      var otherAdmins = $app.findRecordsByFilter(
        'users',
        "role = 'admin' && active = true && id != '" + targetUser.id + "'",
        '',
        0,
        0,
      )
      if (!otherAdmins || otherAdmins.length === 0) {
        return e.json(400, {
          ok: false,
          error:
            'Operação bloqueada: não é permitido remover o último administrador ativo do sistema.',
        })
      }
    }

    $app.delete(targetUser)

    console.log(
      '[users_admin_hook] Usuário removido ' +
        targetUser.getString('email') +
        ' por admin ' +
        currentEmail,
    )

    return e.json(200, {
      ok: true,
      message: 'Usuário removido com sucesso.',
    })
  } catch (err) {
    console.log('[users_admin_hook] Erro ao excluir usuário: ' + err)
    return e.json(500, {
      ok: false,
      error: 'Erro ao excluir usuário: ' + (err.message || err),
    })
  }
})
