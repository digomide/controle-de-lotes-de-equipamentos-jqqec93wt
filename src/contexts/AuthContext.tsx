import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/inventory'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAdmin: boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const rec = pb.authStore.record
      return {
        id: rec.id,
        collectionId: rec.collectionId,
        collectionName: rec.collectionName,
        email: rec.email || '',
        name: rec.name || rec.email || 'Usuário',
        role: rec.role || 'member',
        active: rec.active !== false,
        avatar: rec.avatar || '',
        created: rec.created,
        updated: rec.updated,
      } as User
    }
    return null
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (pb.authStore.isValid) {
          // refresh auth token if possible
          const authData = await pb.collection('users').authRefresh()
          setUser({
            id: authData.record.id,
            collectionId: authData.record.collectionId,
            collectionName: authData.record.collectionName,
            email: authData.record.email || '',
            name: authData.record.name || authData.record.email || 'Usuário',
            role: authData.record.role || 'member',
            active: authData.record.active !== false,
            avatar: authData.record.avatar || '',
            created: authData.record.created,
            updated: authData.record.updated,
          } as User)
        } else {
          setUser(null)
        }
      } catch {
        pb.authStore.clear()
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    const unsubscribe = pb.authStore.onChange((_token, model) => {
      if (model) {
        setUser({
          id: model.id,
          collectionId: model.collectionId,
          collectionName: model.collectionName,
          email: model.email || '',
          name: model.name || model.email || 'Usuário',
          role: model.role || 'member',
          active: model.active !== false,
          avatar: model.avatar || '',
          created: model.created,
          updated: model.updated,
        } as User)
      } else {
        setUser(null)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    setUser({
      id: authData.record.id,
      collectionId: authData.record.collectionId,
      collectionName: authData.record.collectionName,
      email: authData.record.email || '',
      name: authData.record.name || authData.record.email || 'Usuário',
      role: authData.record.role || 'member',
      active: authData.record.active !== false,
      avatar: authData.record.avatar || '',
      created: authData.record.created,
      updated: authData.record.updated,
    } as User)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid) {
      try {
        const authData = await pb.collection('users').authRefresh()
        setUser({
          id: authData.record.id,
          collectionId: authData.record.collectionId,
          collectionName: authData.record.collectionName,
          email: authData.record.email || '',
          name: authData.record.name || authData.record.email || 'Usuário',
          role: authData.record.role || 'member',
          active: authData.record.active !== false,
          avatar: authData.record.avatar || '',
          created: authData.record.created,
          updated: authData.record.updated,
        } as User)
      } catch {
        // keep current user or clear
      }
    }
  }

  const isAdmin = user?.role === 'admin' || user?.email === 'rodrigoifgx@gmail.com'

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
