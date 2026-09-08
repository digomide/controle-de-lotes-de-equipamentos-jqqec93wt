import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/inventory'

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: 'admin' | 'member'
}

export interface UpdateUserInput {
  name?: string
  role?: 'admin' | 'member'
  active?: boolean
}

export interface ResetPasswordResult {
  ok: boolean
  message: string
  userId: string
  email: string
  temporaryPassword?: string
}

export const usersService = {
  /**
   * Lista todos os usuários cadastrados
   */
  async getAll(): Promise<User[]> {
    try {
      const records = await pb.collection('users').getFullList<User>({
        sort: '-created',
      })
      return records
    } catch (err) {
      console.error('[usersService] Erro ao listar usuários:', err)
      throw err
    }
  },

  /**
   * Obtém um usuário por ID
   */
  async getById(id: string): Promise<User> {
    return await pb.collection('users').getOne<User>(id)
  },

  /**
   * Troca a senha do próprio usuário logado usando a API oficial do PocketBase
   */
  async changePassword(
    userId: string,
    payload: { oldPassword: string; password: string; passwordConfirm: string },
  ): Promise<User> {
    return await pb.collection('users').update<User>(userId, payload)
  },

  /**
   * Criação de novo usuário pelo administrador
   * Utiliza rota backend segura com validação de unicidade e permissão
   */
  async createUser(input: CreateUserInput): Promise<User> {
    try {
      // Tentar rota de backend admin primeiro
      const res = await pb.send<{ ok: boolean; user: User; error?: string }>(
        '/backend/v1/users/create',
        {
          method: 'POST',
          body: input,
        },
      )
      if (res && res.user) {
        return res.user
      }
      throw new Error(res?.error || 'Erro ao criar usuário')
    } catch (hookErr: any) {
      // Fallback para SDK nativo do PocketBase caso routerAdd não esteja disponível
      console.warn('[usersService] Fallback nativo PocketBase para criação de usuário:', hookErr)
      return await pb.collection('users').create<User>({
        name: input.name,
        email: input.email,
        password: input.password,
        passwordConfirm: input.password,
        role: input.role,
        active: true,
      })
    }
  },

  /**
   * Atualiza dados de um usuário (papel, nome, status ativo/inativo)
   */
  async updateUser(userId: string, data: UpdateUserInput): Promise<User> {
    try {
      // Tenta rota de backend com proteções de lockout
      const res = await pb.send<{ ok: boolean; user: User; error?: string }>(
        '/backend/v1/users/update',
        {
          method: 'POST',
          body: {
            userId,
            ...data,
          },
        },
      )
      if (res && res.user) {
        return res.user
      }
      throw new Error(res?.error || 'Erro ao atualizar usuário')
    } catch (hookErr: any) {
      console.warn('[usersService] Fallback nativo para atualização de usuário:', hookErr)
      return await pb.collection('users').update<User>(userId, data)
    }
  },

  /**
   * Reseta a senha de um usuário via servidor e gera uma senha provisória para o admin copiar
   */
  async resetPassword(userId: string): Promise<ResetPasswordResult> {
    try {
      const res = await pb.send<ResetPasswordResult>('/backend/v1/users/reset-password', {
        method: 'POST',
        body: { userId },
      })
      if (!res.ok) {
        throw new Error((res as any).error || 'Falha ao resetar senha')
      }
      return res
    } catch (err: any) {
      console.error('[usersService] Erro ao resetar senha:', err)
      throw err
    }
  },

  /**
   * Exclui um usuário (com proteção contra auto-exclusão no backend)
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      const res = await pb.send<{ ok: boolean; error?: string }>(
        `/backend/v1/users/delete?id=${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
        },
      )
      if (res && res.ok) {
        return true
      }
      throw new Error(res?.error || 'Erro ao remover usuário')
    } catch (hookErr: any) {
      console.warn('[usersService] Fallback nativo para remoção de usuário:', hookErr)
      return await pb.collection('users').delete(userId)
    }
  },
}
