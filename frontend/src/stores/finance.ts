// src/stores/finance.ts
import { defineStore } from 'pinia'
import api, { type ApiError } from '../plugins/api'

export interface MonthlyExpense {
  MONTH: string
  TOTAL_EXPENSE: number
}

export interface RecentTransaction {
  id: number
  date: string
  amount: number
  description: string
  reference: string
  type: 'income' | 'expense' | 'transfer'
  category: string
}

export interface DashboardSummary {
  currentBalance: number
  monthlyIncome: number
  monthlyExpense: number
  recentTransactions: RecentTransaction[]
}

interface FinanceState {
  monthlyExpenses: MonthlyExpense[]
  summary: DashboardSummary | null
  loadingExpenses: boolean
  loadingSummary: boolean
  errorExpenses: string | null
  errorSummary: string | null
}

interface ExpensesApiResponse {
  success: boolean
  data: MonthlyExpense[]
  mocked?: boolean
}

interface SummaryApiResponse {
  success: boolean
  data: DashboardSummary
}

export const useFinanceStore = defineStore('finance', {
  state: (): FinanceState => ({
    monthlyExpenses: [],
    summary: null,
    loadingExpenses: false,
    loadingSummary: false,
    errorExpenses: null,
    errorSummary: null
  }),

  actions: {
    async fetchMonthlyExpenses(): Promise<void> {
      this.loadingExpenses = true
      this.errorExpenses = null
      try {
        const response = await api.get<ExpensesApiResponse>('/expenses/monthly')
        if (response.data.success) {
          this.monthlyExpenses = response.data.data
        }
      } catch (err) {
        const e = err as ApiError
        this.errorExpenses = e.message || 'Failed to fetch expenses'
        // Only log unexpected server errors — 4xx are handled silently in the UI
        if (!e.isClientError && !e.isNetworkError) {
          console.warn('[Finance] Unexpected error fetching expenses:', e.message)
        }
      } finally {
        this.loadingExpenses = false
      }
    },

    async fetchDashboardSummary(): Promise<void> {
      this.loadingSummary = true
      this.errorSummary = null
      try {
        const response = await api.get<SummaryApiResponse>('/dashboard/summary')
        if (response.data.success) {
          this.summary = response.data.data
        }
      } catch (err) {
        const e = err as ApiError
        this.errorSummary = e.message || 'Failed to fetch dashboard summary'
        // Only log unexpected server errors — 4xx are handled silently in the UI
        if (!e.isClientError && !e.isNetworkError) {
          console.warn('[Finance] Unexpected error fetching summary:', e.message)
        }
      } finally {
        this.loadingSummary = false
      }
    }
  }
})
