<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import OfflineBanner from './components/OfflineBanner.vue'

const route     = useRoute()
const router    = useRouter()
const authStore = useAuthStore()

const isAuthRoute = computed(() => ['Login', 'Register'].includes(route.name as string))

const navItems = [
  { name: 'Dashboard',    path: '/',              icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { name: 'Transactions', path: '/transactions',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { name: 'Analytics',    path: '/analytics',    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
]

const logout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <OfflineBanner />

  <!-- Auth: full-screen, no sidebar -->
  <template v-if="isAuthRoute">
    <router-view v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </router-view>
  </template>

  <!-- App: sidebar + content -->
  <template v-else>
    <div style="display:flex; min-height:100vh;">

      <!-- Sidebar -->
      <aside style="
        width: 220px; flex-shrink: 0;
        background: #1e293b;
        border-right: 1px solid #334155;
        display: flex; flex-direction: column;
        position: fixed; top: 0; bottom: 0; left: 0;
        z-index: 40;
      ">
        <!-- Logo -->
        <div style="padding: 20px 16px 16px; border-bottom: 1px solid #334155;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="
              width:32px; height:32px; border-radius:8px;
              background: #3b82f6;
              display:flex; align-items:center; justify-content:center;
              flex-shrink:0;
            ">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <span style="font-weight:700; font-size:15px; color:#f1f5f9;">FinanceApp</span>
          </div>
        </div>

        <!-- Nav -->
        <nav style="padding: 12px 8px; flex: 1;">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            custom
            v-slot="{ isActive, navigate }"
          >
            <button
              @click="navigate"
              :style="{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '9px 10px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '2px',
                background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: isActive ? '#60a5fa' : '#94a3b8',
                transition: 'all 0.15s',
              }"
              @mouseenter="(e: MouseEvent) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }"
              @mouseleave="(e: MouseEvent) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon"/>
              </svg>
              {{ item.name }}
            </button>
          </router-link>
        </nav>

        <!-- User section -->
        <div style="padding: 12px 8px; border-top: 1px solid #334155;">
          <div style="
            display: flex; align-items: center; gap: 10px;
            padding: 8px 10px; border-radius: 8px;
            background: rgba(255,255,255,0.03);
          ">
            <img
              :src="`https://api.dicebear.com/7.x/initials/svg?seed=${authStore.user?.name}&backgroundColor=1e40af`"
              :alt="authStore.user?.name"
              style="width:28px; height:28px; border-radius:50%; flex-shrink:0;"
            />
            <div style="flex:1; min-width:0;">
              <p style="font-size:13px; font-weight:500; color:#f1f5f9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                {{ authStore.user?.name }}
              </p>
              <p style="font-size:11px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                {{ authStore.user?.email }}
              </p>
            </div>
            <button
              @click="logout"
              title="Logout"
              style="
                background:none; border:none; cursor:pointer;
                color:#64748b; padding:4px; border-radius:4px;
                flex-shrink:0;
              "
              @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color='#f87171'"
              @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.color='#64748b'"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main content area -->
      <main style="margin-left: 220px; flex:1; padding: 28px; min-height: 100vh;">
        <router-view v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </router-view>
      </main>

    </div>
  </template>
</template>
