migrate(
  (app) => {
    // 1. Garantir que usuário admin rodrigoifgx@gmail.com possui a senha conhecida Skip@Pass
    try {
      const adminUsers = app.findRecordsByFilter(
        'users',
        "email = 'rodrigoifgx@gmail.com'",
        '',
        1,
        0,
      )
      if (adminUsers && adminUsers.length > 0) {
        const adminUser = adminUsers[0]
        adminUser.setPassword('Skip@Pass')
        adminUser.set('role', 'admin')
        adminUser.set('name', 'Rodrigo Admin')
        app.save(adminUser)
        console.log(
          '[migration 0426] Usuário admin rodrigoifgx@gmail.com verificado com senha Skip@Pass',
        )
      }
    } catch (err) {
      console.log('[migration 0426] Erro ao atualizar admin: ' + err)
    }

    // 2. Garantir usuário membro (operador@loteequip.com) para testes de papéis
    try {
      const memberUsers = app.findRecordsByFilter(
        'users',
        "email = 'operador@loteequip.com'",
        '',
        1,
        0,
      )
      if (!memberUsers || memberUsers.length === 0) {
        const usersCol = app.findCollectionByNameOrId('users')
        const newMember = new Record(usersCol)
        newMember.set('email', 'operador@loteequip.com')
        newMember.setPassword('Skip@Pass')
        newMember.set('name', 'Operador de Vendas')
        newMember.set('role', 'member')
        newMember.set('verified', true)
        app.save(newMember)
        console.log(
          '[migration 0426] Usuário membro operador@loteequip.com criado com senha Skip@Pass',
        )
      } else {
        const member = memberUsers[0]
        member.setPassword('Skip@Pass')
        member.set('role', 'member')
        app.save(member)
        console.log(
          '[migration 0426] Usuário membro operador@loteequip.com verificado com senha Skip@Pass',
        )
      }
    } catch (err) {
      console.log('[migration 0426] Erro ao criar/atualizar membro: ' + err)
    }
  },
  (app) => {
    // down migration
  },
)
