// Hook administrativo para gestão avançada de usuários e proteção de login
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

// Rota para criar novo usuário via backend admin
routerAdd('POST', '/backend/v1/users/create', (e) => {
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

    console.log(
      '[users_admin_hook] Novo usuário criado: ' +
        email +
        ' (papel: ' +
        role +
        ') por admin ' +
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

// Rota para alternar papel / ativar / desativar usuário com proteção contra lockout
routerAdd('POST', '/backend/v1/users/update', (e) => {
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

    if (body.name !== undefined) {
      targetUser.set('name', String(body.name).trim())
    }

    if (body.role !== undefined) {
      var targetRole = String(body.role).toLowerCase()
      if (targetRole === 'admin' || targetRole === 'member') {
        targetUser.set('role', targetRole)
      }
    }

    if (body.active !== undefined) {
      targetUser.set('active', Boolean(body.active))
    }

    $app.save(targetUser)

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

// Rota para excluir usuário com proteção contra auto-exclusão
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
