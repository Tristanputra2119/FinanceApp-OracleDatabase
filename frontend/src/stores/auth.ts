// src/stores/auth.ts
import { defineStore } from 'pinia'
import api from '../plugins/api'

interface User {
  id: number
  name: string
  email: string
}

interface AuthState {
  token: string | null
  user: User | null
  error: string | null
  loading: boolean
}

interface LoginResponse {
  success: boolean
  token: string
  user: User
}

interface RegisterResponse {
  success: boolean
  message: string
  userId: number
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem('token') || null,
    user: (() => {
      try {
        const stored = localStorage.getItem('user')
        return stored ? (JSON.parse(stored) as User) : null
      } catch {
        return null
      }
    })(),
    error: null,
    loading: false
  }),

  getters: {
    isAuthenticated: (state): boolean => !!state.token
  },

  actions: {
    async login(email: string, password: string): Promise<boolean> {
      this.loading = true
      this.error = null
      try {
        const response = await api.post<LoginResponse>('/auth/login', { email, password })
        if (response.data.success) {
          this.token = response.data.token
          this.user = response.data.user
          localStorage.setItem('token', this.token)
          localStorage.setItem('user', JSON.stringify(this.user))
          return true
        }
        return false
      } catch (err) {
        const apiErr = err as { response?: { data?: { message?: string } }; isNetworkError?: boolean }
        if (apiErr.isNetworkError) {
          this.error = 'Cannot reach the server. Is the backend running?'
        } else {
          this.error = apiErr.response?.data?.message || 'Login failed'
        }
        return false
      } finally {
        this.loading = false
      }
    },

    async register(name: string, email: string, password: string): Promise<boolean> {
      this.loading = true
      this.error = null
      try {
        const response = await api.post<RegisterResponse>('/auth/register', { name, email, password })
        return response.data.success
      } catch (err) {
        const apiErr = err as { response?: { data?: { message?: string } }; isNetworkError?: boolean }
        if (apiErr.isNetworkError) {
          this.error = 'Cannot reach the server. Is the backend running?'
        } else {
          this.error = apiErr.response?.data?.message || 'Registration failed'
        }
        return false
      } finally {
        this.loading = false
      }
    },

    logout(): void {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }
})
