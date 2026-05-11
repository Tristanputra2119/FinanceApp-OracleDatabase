<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBackendStatus } from '../composables/useBackendStatus'

const router    = useRouter()
const authStore = useAuthStore()
const { isOnline } = useBackendStatus()

const email    = ref('')
const password = ref('')
const showPass = ref(false)

const submit = async () => {
  const ok = await authStore.login(email.value, password.value)
  if (ok) router.push('/')
}
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <!-- Logo -->
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:1.5rem;">
        <div style="width:36px; height:36px; border-radius:8px; background:#3b82f6; display:flex; align-items:center; justify-content:center;">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div>
          <p style="font-weight:700; font-size:16px;">FinanceApp</p>
          <p style="color:#64748b; font-size:12px;">Sign in to your account</p>
        </div>
      </div>

      <!-- Offline notice -->
      <div v-if="isOnline === false" style="
        background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3);
        border-radius: 8px; padding: 10px 12px; margin-bottom: 16px;
        color: #fbbf24; font-size: 13px; display:flex; align-items:center; gap:8px;
      ">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        Backend offline — login unavailable
      </div>

      <!-- Error -->
      <div v-if="authStore.error" style="
        background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
        border-radius: 8px; padding: 10px 12px; margin-bottom: 16px;
        color: #fca5a5; font-size: 13px;
      ">{{ authStore.error }}</div>

      <!-- Form -->
      <form @submit.prevent="submit" style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="display:block; font-size:13px; color:#94a3b8; margin-bottom:6px;">Email</label>
          <input v-model="email" type="email" required class="input" placeholder="you@example.com" />
        </div>

        <div>
          <label style="display:block; font-size:13px; color:#94a3b8; margin-bottom:6px;">Password</label>
          <div style="position:relative;">
            <input
              v-model="password"
              :type="showPass ? 'text' : 'password'"
              required
              class="input"
              placeholder="••••••••"
              style="padding-right: 40px;"
            />
            <button
              type="button"
              @click="showPass = !showPass"
              style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#64748b;"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path v-if="!showPass" stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                <path v-else stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
              </svg>
            </button>
          </div>
        </div>

        <button
          type="submit"
          class="btn btn-primary"
          style="width:100%; justify-content:center; margin-top:4px;"
          :disabled="authStore.loading || isOnline === false"
        >
          <svg v-if="authStore.loading" class="animate-spin" width="15" height="15" fill="none" viewBox="0 0 24 24">
            <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {{ authStore.loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>

      <p style="text-align:center; margin-top:1.25rem; color:#64748b; font-size:13px;">
        No account?
        <router-link to="/register" style="color:#60a5fa; text-decoration:none; font-weight:500;"> Create one</router-link>
      </p>
    </div>
  </div>
</template>
