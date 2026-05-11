<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Array,
    required: true
  }
})

const chartOptions = computed(() => {
  // Sort data chronologically for the chart
  const sortedData = [...props.data].sort((a, b) => new Date(a.MONTH) - new Date(b.MONTH))
  
  return {
    chart: {
      type: 'area',
      height: 300,
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'Inter, sans-serif'
    },
    colors: ['#3b82f6'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [50, 100]
      }
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: sortedData.map(d => {
        const date = new Date(d.MONTH + '-01')
        return date.toLocaleDateString('default', { month: 'short', year: '2-digit' })
      }),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: '#94a3b8' }
      }
    },
    yaxis: {
      labels: {
        style: { colors: '#94a3b8' },
        formatter: (value) => '$' + value.toLocaleString()
      }
    },
    grid: {
      borderColor: '#334155',
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } }
    },
    theme: { mode: 'dark' },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val) => '$' + val.toLocaleString() }
    }
  }
})

const series = computed(() => {
  const sortedData = [...props.data].sort((a, b) => new Date(a.MONTH) - new Date(b.MONTH))
  return [{
    name: 'Expenses',
    data: sortedData.map(d => d.TOTAL_EXPENSE || 0)
  }]
})
</script>

<template>
  <apexchart 
    type="area" 
    height="300" 
    :options="chartOptions" 
    :series="series" 
  />
</template>
