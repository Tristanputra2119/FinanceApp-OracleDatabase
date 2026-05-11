<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useFinanceStore } from '../stores/finance'

const store = useFinanceStore()

onMounted(() => {
  store.fetchDashboardSummary()
  store.fetchMonthlyExpenses()
})

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const fmtDate = (d: string | Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d))

const totalExpenses = computed(() =>
  store.monthlyExpenses.reduce((acc, m) => acc + (m.TOTAL_EXPENSE || 0), 0)
)
</script>

<template>
  <div>
    <!-- Page header -->
    <div style="margin-bottom:24px;">
      <h1 style="font-size:20px; font-weight:700;">Dashboard</h1>
      <p style="color:#64748b; margin-top:2px;">Overview of your finances</p>
    </div>

    <!-- Stat cards -->
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px;">

      <!-- Balance -->
      <div class="card" style="padding:20px;">
        <p style="font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Current Balance</p>
        <div v-if="store.loadingSummary" style="height:28px; width:120px; background:#334155; border-radius:6px; animation:pulse 1.5s infinite;"></div>
        <p v-else style="font-size:22px; font-weight:700;">{{ fmt(store.summary?.currentBalance ?? 0) }}</p>
        <p style="font-size:12px; color:#64748b; margin-top:4px;">Total assets</p>
      </div>

      <!-- Monthly Income -->
      <div class="card" style="padding:20px;">
        <p style="font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Monthly Income</p>
        <div v-if="store.loadingSummary" style="height:28px; width:100px; background:#334155; border-radius:6px;"></div>
        <p v-else style="font-size:22px; font-weight:700; color:#4ade80;">{{ fmt(store.summary?.monthlyIncome ?? 0) }}</p>
        <p style="font-size:12px; color:#64748b; margin-top:4px;">This month</p>
      </div>

      <!-- Monthly Expense -->
      <div class="card" style="padding:20px;">
        <p style="font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Monthly Expenses</p>
        <div v-if="store.loadingSummary" style="height:28px; width:100px; background:#334155; border-radius:6px;"></div>
        <p v-else style="font-size:22px; font-weight:700; color:#f87171;">{{ fmt(store.summary?.monthlyExpense ?? 0) }}</p>
        <p style="font-size:12px; color:#64748b; margin-top:4px;">This month</p>
      </div>

    </div>

    <!-- Recent Transactions -->
    <div class="card">
      <div style="padding:16px 20px; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between;">
        <h2 style="font-size:15px; font-weight:600;">Recent Transactions</h2>
        <router-link to="/transactions" style="font-size:13px; color:#60a5fa; text-decoration:none;">View all →</router-link>
      </div>

      <!-- Loading -->
      <div v-if="store.loadingSummary" style="padding:20px;">
        <div v-for="i in 5" :key="i" style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <div style="width:32px; height:32px; border-radius:50%; background:#334155;"></div>
          <div style="flex:1;">
            <div style="height:12px; width:40%; background:#334155; border-radius:4px; margin-bottom:6px;"></div>
            <div style="height:10px; width:25%; background:#1e293b; border-radius:4px;"></div>
          </div>
          <div style="height:12px; width:60px; background:#334155; border-radius:4px;"></div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="store.errorSummary" style="padding:20px; color:#f87171; font-size:13px;">
        {{ store.errorSummary }}
      </div>

      <!-- Empty -->
      <div v-else-if="!store.summary?.recentTransactions?.length" style="padding:40px 20px; text-align:center; color:#475569;">
        <p style="margin-bottom:4px;">No transactions yet.</p>
        <router-link to="/transactions" style="color:#60a5fa; font-size:13px; text-decoration:none;">Add your first transaction →</router-link>
      </div>

      <!-- List -->
      <table v-else class="table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Date</th>
            <th>Type</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in store.summary!.recentTransactions" :key="tx.id">
            <td>
              <p style="font-weight:500;">{{ tx.description }}</p>
              <p style="font-size:12px; color:#64748b;">{{ tx.category }}</p>
            </td>
            <td style="color:#94a3b8; font-size:13px;">{{ fmtDate(tx.date) }}</td>
            <td>
              <span :class="['badge', tx.type === 'income' ? 'badge-green' : tx.type === 'expense' ? 'badge-red' : 'badge-blue']">
                {{ tx.type }}
              </span>
            </td>
            <td style="text-align:right; font-weight:600;" :style="{ color: tx.type === 'income' ? '#4ade80' : tx.type === 'expense' ? '#f87171' : '#94a3b8' }">
              {{ tx.type === 'income' ? '+' : '-' }}{{ fmt(tx.amount) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
