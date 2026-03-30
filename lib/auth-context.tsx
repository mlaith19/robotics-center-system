"use client"

import { createContext, useContext } from "react"

export interface CurrentUser {
  id: string
  username: string
  full_name: string
  role: string
  roleKey?: string
  permissions?: string[]
  loginTime?: string
}

const AuthContext = createContext<CurrentUser | null>(null)

export function useCurrentUser(): CurrentUser | null {
  return useContext(AuthContext)
}

export const AuthProvider = AuthContext.Provider
