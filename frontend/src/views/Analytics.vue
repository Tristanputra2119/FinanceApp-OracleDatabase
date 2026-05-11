<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import api from '../plugins/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface MonthData {
  label: string
  expense: number
  income: number
}

interface NextMonth {
  label: string
  predicted_expense: number
  predicted_income: number
}

interface Prediction {
  r_squared: number
  confidence: number
  trend: 'increasing' | 'decreasing' | 'stable'
  exp_slope: number
  avg_expense: number
  next_months: NextMonth[]
}

interface AnalyticsData {
  months: MonthData[]
  prediction: Prediction | null
}

interface CategoryRow {
  CATEGORY: string
  TOTAL: number
}

// ─── State ────────────────────────────────────────────────────────────────────
const loading   = ref(true)
const error     = ref('')
const data      = ref<AnalyticsData | null>(null)
const breakdown = ref<CategoryRow[]>([])

// ─── Fetch ────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const [chartRes, breakRes] = await Promise.all([
      api.get<{ success: boolean; data: AnalyticsData }>('/analytics/chart'),
      api.get<{ success: boolean; data: CategoryRow[] }>('/analytics/breakdown'),
    ])
    data.value      = chartRes.data.data
    breakdown.value = breakRes.data.data
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// ─── Chart 1: Income vs Expense bar chart ─────────────────────────────────────
const barOptions = computed(() => ({
  chart: { type: 'bar', toolbar: { show: false }, background: 'transparent', fontFamily: 'Inter, sans-serif' },
  colors: ['#22c55e', '#ef4444'],
  plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
  dataLabels: { enabled: false },
  xaxis: {
    categories: data.value?.months.map(m => fmtLabel(m.label)) ?? [],
    labels: { style: { colors: '#64748b', fontSize: '12px' } },
    axisBorder: { color: '#334155' },
    axisTicks: { color: '#334155' },
  },
  yaxis: {
    labels: {
      style: { colors: '#64748b', fontSize: '12px' },
      formatter: (v: number) => '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v),
    },
  },
  grid: { borderColor: '#1e293b', strokeDashArray: 4 },
  legend: { labels: { colors: '#94a3b8' } },
  tooltip: {
    theme: 'dark',
    y: { formatter: (v: number) => fmt(v) },
  },
}))

const barSeries = computed(() => [
  { name: 'Income',  data: data.value?.months.map(m => m.income)  ?? [] },
  { name: 'Expense', data: data.value?.months.map(m => m.expense) ?? [] },
])

// ─── Chart 2: Expense trend + prediction ──────────────────────────────────────
const lineOptions = computed(() => {
  const historical = data.value?.months ?? []
  const predicted  = data.value?.prediction?.next_months ?? []

  // All labels: historical + predicted (dashed)
  const allLabels = [
    ...historical.map(m => fmtLabel(m.label)),
    ...predicted.map(m => fmtLabel(m.label)),
  ]

  // Historical data + null padding for predicted slots
  const histData = [
    ...historical.map(m => m.expense),
    ...predicted.map(() => null),
  ]

  // null padding for historical slots + predicted values
  const predData = [
    ...historical.map(() => null),
    // Include last historical point as bridge so line connects
    ...predicted.map(m => m.predicted_expense),
  ]

  // Bridge: last historical point repeated as first value of prediction series
  if (historical.length > 0 && predicted.length > 0) {
    predData[historical.length - 1] = historical[historical.length - 1].expense
  }

  return {
    chart: { type: 'line', toolbar: { show: false }, background: 'transparent', fontFamily: 'Inter, sans-serif' },
    colors: ['#3b82f6', '#f59e0b'],
    stroke: {
      curve: 'smooth',
      width: [2, 2],
      dashArray: [0, 6],
    },
    markers: { size: [3, 5], strokeWidth: 0 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: allLabels,
      labels: { style: { colors: '#64748b', fontSize: '12px' } },
      axisBorder: { color: '#334155' },
      axisTicks: { color: '#334155' },
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b', fontSize: '12px' },
        formatter: (v: number) => v != null ? '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v)) : '',
      },
    },
    grid: { borderColor: '#1e293b', strokeDashArray: 4 },
    legend: { labels: { colors: '#94a3b8' } },
    tooltip: {
      theme: 'dark',
      shared: true,
      y: { formatter: (v: number | null) => v != null ? fmt(v) : '—' },
    },
    annotations: {
      xaxis: historical.length > 0
        ? [{
            x: fmtLabel(historical[historical.length - 1].label),
            borderColor: '#475569',
            strokeDashArray: 4,
            label: { text: 'Today', style: { color: '#94a3b8', background: '#1e293b', fontSize: '11px' } },
          }]
        : [],
    },
  }
})

const lineSeries = computed(() => {
  const historical = data.value?.months ?? []
  const predicted  = data.value?.prediction?.next_months ?? []
  const histData   = [...historical.map(m => m.expense), ...predicted.map(() => null)]
  const predData: (number | null)[] = [...historical.map(() => null), ...predicted.map(m => m.predicted_expense)]

  if (historical.length > 0 && predicted.length > 0) {
    predData[historical.length - 1] = historical[historical.length - 1].expense
  }

  return [
    { name: 'Actual Expense', data: histData },
    { name: 'Predicted Expense', data: predData },
  ]
})

// ─── Chart 3: Pie — category breakdown ────────────────────────────────────────
const pieOptions = computed(() => ({
  chart: { type: 'donut', background: 'transparent', fontFamily: 'Inter, sans-serif' },
  labels: breakdown.value.map(b => b.CATEGORY),
  colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'],
  dataLabels: { style: { fontSize: '12px', fontFamily: 'Inter, sans-serif' } },
  legend: {
    position: 'bottom',
    labels: { colors: '#94a3b8' },
    fontSize: '12px',
  },
  plotOptions: { pie: { donut: { size: '60%' } } },
  tooltip: {
    theme: 'dark',
    y: { formatter: (v: number) => fmt(v) },
  },
}))

const pieSeries = computed(() => breakdown.value.map(b => Number(b.TOTAL ?? 0)))

// ─── Prediction confidence display ───────────────────────────────────────────
const confidenceColor = computed(() => {
  const c = data.value?.prediction?.confidence ?? 0
  if (c >= 70) return '#22c55e'
  if (c >= 40) return '#eab308'
  return '#ef4444'
})

const trendIcon = computed(() => {
  const t = data.value?.prediction?.trend
  if (t === 'increasing') return '↑'
  if (t === 'decreasing') return '↓'
  return '→'
})

const trendColor = computed(() => {
  const t = data.value?.prediction?.trend
  if (t === 'increasing') return '#ef4444'
  if (t === 'decreasing') return '#22c55e'
  return '#94a3b8'
})
</script>

<template>
  <div>
    <!-- Header -->
    <div style="margin-bottom:24px;">
      <h1 style="font-size:20px; font-weight:700;">Analytics & Predictions</h1>
      <p style="color:#64748b; margin-top:2px;">
        Powered by Oracle Database linear regression
        <span style="
          display:inline-flex; align-items:center; gap:4px;
          background:rgba(249,115,22,0.12); color:#fb923c;
          border:1px solid rgba(249,115,22,0.3);
          border-radius:4px; padding:1px 8px; font-size:11px; font-weight:600;
          margin-left:8px;
        ">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
          ORACLE ATP
        </span>
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="display:grid; gap:16px;">
      <div v-for="i in 4" :key="i" style="height:280px; border-radius:12px;" class="card"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" style="
      background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3);
      border-radius:12px; padding:20px; color:#fca5a5;
    ">
      <p style="font-weight:600; margin-bottom:4px;">Failed to load analytics</p>
      <p style="font-size:13px;">{{ error }}</p>
    </div>

    <template v-else-if="data">

      <!-- ── Prediction summary cards ─────────────────────────────────────── -->
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:20px;">

        <!-- Trend -->
        <div class="card" style="padding:18px;">
          <p style="font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Expense Trend</p>
          <p style="font-size:28px; font-weight:800;" :style="{ color: trendColor }">{{ trendIcon }}</p>
          <p style="font-size:13px; font-weight:500; margin-top:4px;" :style="{ color: trendColor }">
            {{ data.prediction?.trend ?? '—' }}
          </p>
        </div>

        <!-- Avg expense -->
        <div class="card" style="padding:18px;">
          <p style="font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Monthly Avg Expense</p>
          <p style="font-size:20px; font-weight:700; color:#f1f5f9;">{{ fmt(data.prediction?.avg_expense ?? 0) }}</p>
          <p style="font-size:12px; color:#64748b; margin-top:4px;">12-month average</p>
        </div>

        <!-- R² confidence -->
        <div class="card" style="padding:18px;">
          <p style="font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Model Confidence (R²)</p>
          <p style="font-size:20px; font-weight:700;" :style="{ color: confidenceColor }">
            {{ data.prediction?.confidence ?? 0 }}%
          </p>
          <div style="height:4px; background:#1e293b; border-radius:2px; margin-top:8px;">
            <div :style="{
              height:'4px', borderRadius:'2px',
              width: (data.prediction?.confidence ?? 0) + '%',
              background: confidenceColor,
              transition: 'width 0.6s ease',
            }"></div>
          </div>
        </div>

        <!-- Slope -->
        <div class="card" style="padding:18px;">
          <p style="font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Expense Slope / Month</p>
          <p style="font-size:20px; font-weight:700;"
            :style="{ color: (data.prediction?.exp_slope ?? 0) > 0 ? '#ef4444' : '#22c55e' }">
            {{ (data.prediction?.exp_slope ?? 0) > 0 ? '+' : '' }}{{ fmt(data.prediction?.exp_slope ?? 0) }}
          </p>
          <p style="font-size:12px; color:#64748b; margin-top:4px;">per month change</p>
        </div>
      </div>

      <!-- ── Predicted next 3 months ───────────────────────────────────────── -->
      <div v-if="data.prediction" style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:20px;">
        <div
          v-for="(month, i) in data.prediction.next_months"
          :key="month.label"
          class="card"
          style="padding:18px; border-left:3px solid #f59e0b;"
        >
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
            <p style="font-size:13px; font-weight:600; color:#94a3b8;">{{ fmtLabel(month.label) }}</p>
            <span style="
              font-size:10px; font-weight:700; padding:2px 7px;
              background:rgba(245,158,11,0.12); color:#f59e0b;
              border-radius:4px; letter-spacing:0.05em;
            ">FORECAST +{{ i + 1 }}M</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; color:#64748b;">Predicted Expense</span>
              <span style="font-size:14px; font-weight:700; color:#f87171;">{{ fmt(month.predicted_expense) }}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; color:#64748b;">Predicted Income</span>
              <span style="font-size:14px; font-weight:700; color:#4ade80;">{{ fmt(month.predicted_income) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Charts row ────────────────────────────────────────────────────── -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">

        <!-- Bar: Income vs Expense -->
        <div class="card" style="padding:20px;">
          <p style="font-size:14px; font-weight:600; margin-bottom:4px;">Income vs Expense</p>
          <p style="font-size:12px; color:#64748b; margin-bottom:16px;">Monthly comparison · last 12 months</p>
          <VueApexCharts
            type="bar"
            height="260"
            :options="barOptions"
            :series="barSeries"
          />
        </div>

        <!-- Category breakdown donut -->
        <div class="card" style="padding:20px;">
          <p style="font-size:14px; font-weight:600; margin-bottom:4px;">Expense Breakdown</p>
          <p style="font-size:12px; color:#64748b; margin-bottom:16px;">By category · this month</p>
          <div v-if="pieSeries.length === 0" style="height:260px; display:flex; align-items:center; justify-content:center; color:#475569; font-size:13px;">
            No expense data for this month
          </div>
          <VueApexCharts
            v-else
            type="donut"
            height="260"
            :options="pieOptions"
            :series="pieSeries"
          />
        </div>
      </div>

      <!-- ── Expense Prediction line chart (full width) ───────────────────── -->
      <div class="card" style="padding:20px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:4px;">
          <div>
            <p style="font-size:14px; font-weight:600;">Expense Forecast</p>
            <p style="font-size:12px; color:#64748b; margin-top:2px;">
              Historical (solid) + 3-month prediction (dashed) using Oracle
              <code style="font-size:11px; background:#1e293b; padding:1px 5px; border-radius:3px;">REGR_SLOPE / REGR_INTERCEPT</code>
            </p>
          </div>
          <div v-if="data.prediction" style="text-align:right;">
            <p style="font-size:11px; color:#64748b;">Model R²</p>
            <p style="font-size:14px; font-weight:700;" :style="{ color: confidenceColor }">
              {{ data.prediction.r_squared.toFixed(3) }}
            </p>
          </div>
        </div>
        <VueApexCharts
          type="line"
          height="280"
          :options="lineOptions"
          :series="lineSeries"
          style="margin-top:12px;"
        />
      </div>

    </template>
  </div>
</template>
