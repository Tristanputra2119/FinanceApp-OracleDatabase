<script setup lang="ts">
import { useBackendStatus } from '../composables/useBackendStatus'

const { isOnline, isChecking, retry } = useBackendStatus()
</script>

<template>
  <!-- Offline banner — slides in from top when backend is unreachable -->
  <Transition name="banner">
    <div
      v-if="isOnline === false"
      class="offline-banner"
      role="alert"
      aria-live="assertive"
    >
      <div class="banner-inner">
        <!-- Pulse indicator -->
        <span class="pulse-dot"></span>

        <div class="banner-text">
          <span class="banner-title">Backend Offline</span>
          <span class="banner-sub">Cannot reach the server at <code>localhost:5000</code></span>
        </div>

        <button
          @click="retry"
          :disabled="isChecking"
          class="retry-btn"
          aria-label="Retry connection"
        >
          <svg
            :class="['retry-icon', { 'spinning': isChecking }]"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          {{ isChecking ? 'Checking...' : 'Retry' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.offline-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);
  border-bottom: 1px solid rgba(255, 100, 100, 0.3);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.banner-inner {
  max-width: 80rem;
  margin: 0 auto;
  padding: 0.625rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pulse-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fca5a5;
  flex-shrink: 0;
  animation: pulse-red 1.5s ease-in-out infinite;
}

@keyframes pulse-red {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}

.banner-text {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.banner-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #fecaca;
}

.banner-sub {
  font-size: 0.8rem;
  color: #fca5a5;
}

.banner-sub code {
  font-family: 'Courier New', monospace;
  background: rgba(0,0,0,0.2);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}

.retry-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.875rem;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  color: #fecaca;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.retry-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.2);
}

.retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.retry-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.3s;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Banner slide-in/out animation */
.banner-enter-active,
.banner-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.banner-enter-from,
.banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
