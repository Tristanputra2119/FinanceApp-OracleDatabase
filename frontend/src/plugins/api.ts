// src/plugins/api.ts

export interface ApiError extends Error {
  response?: { data: { message?: string; success?: boolean }; status: number }
  isNetworkError?: boolean
  /** True for 4xx errors — expected application-level rejections, not bugs */
  isClientError?: boolean
}

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>
  body?: unknown
}

interface ApiResponse<T = unknown> {
  data: T
  status: number
}

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:5000/api'

// Derive health URL from base (strip /api)
export const HEALTH_URL = BASE_URL.replace(/\/api$/, '') + '/health'

const api = {
  async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = `${BASE_URL}${endpoint}`

    const headers = new Headers((options.headers as Record<string, string>) || {})
    headers.set('Content-Type', 'application/json')
    // 🔒 Required by backend API guard — identifies requests from our app
    headers.set('X-App-Request', '1')

    const token = localStorage.getItem('token')
    if (token) headers.set('Authorization', `Bearer ${token}`)

    let response: Response
    try {
      response = await fetch(url, {
        ...options,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
      })
    } catch {
      // Network error — backend is offline or unreachable
      const netErr = new Error(
        'Cannot connect to the server. Please check if the backend is running.'
      ) as ApiError
      netErr.isNetworkError = true
      throw netErr
    }

    const data = await response.json().catch(() => ({}) as T) as T

    if (!response.ok) {
      const message = (data as { message?: string })?.message || `Request failed with status ${response.status}`
      const err = new Error(message) as ApiError
      err.response = { data: data as { message?: string }, status: response.status }

      if (response.status >= 400 && response.status < 500) {
        // 4xx = client error (wrong password, not found, forbidden, etc.)
        // These are expected application flow — NOT bugs.
        // Callers handle the message via err.response and show it in the UI.
        // Never log these to the console.
        err.isClientError = true
      } else {
        // 5xx = unexpected server error — worth a warning for developers
        console.warn(`[API] Server error ${response.status} on ${options.method ?? 'GET'} ${endpoint}`)
      }

      throw err
    }

    return { data, status: response.status }
  },

  get<T = unknown>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  },
  post<T = unknown>(endpoint: string, body: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body })
  },
  put<T = unknown>(endpoint: string, body: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body })
  },
  delete<T = unknown>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

export default api
