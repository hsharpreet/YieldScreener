'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { fetchMe, logout as apiLogout, UserOut } from '@/lib/api'

interface AuthContextValue {
  user: UserOut | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const u = await fetchMe()
    setUser(u)
    setLoading(false)
  }

  const logout = async () => {
    await apiLogout()
    setUser(null)
  }

  useEffect(() => { refresh() }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
