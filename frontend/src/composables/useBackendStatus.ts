// src/composables/useBackendStatus.ts
import { ref, onMounted, onUnmounted } from 'vue'
import { HEALTH_URL } from '../plugins/api'

// Shared reactive state (module-level singleton — all components share the same value)
const isOnline = ref<boolean | null>(null)   // null = still checking
const isChecking = ref(false)

let intervalId: ReturnType<typeof setInterval> | null = null
let refCount = 0

async function checkHealth(): Promise<void> {
  if (isChecking.value) return
  isChecking.value = true
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)  // 5s timeout
    })
    isOnline.value = res.ok
  } catch {
    isOnline.value = false
  } finally {
    isChecking.value = false
  }
}

export function useBackendStatus() {
  onMounted(() => {
    refCount++
    // Only start interval once (shared across all consumers)
    if (refCount === 1) {
      checkHealth()
      intervalId = setInterval(checkHealth, 30_000)  // re-check every 30s
    }
  })

  onUnmounted(() => {
    refCount--
    if (refCount === 0 && intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  })

  return {
    isOnline,
    isChecking,
    retry: checkHealth
  }
}
