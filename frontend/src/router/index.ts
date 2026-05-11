import { createRouter, createWebHistory } from 'vue-router'
import Dashboard    from '../views/Dashboard.vue'
import Login        from '../views/Login.vue'
import Register     from '../views/Register.vue'
import Transactions from '../views/Transactions.vue'
import Analytics    from '../views/Analytics.vue'

const routes = [
  { path: '/',             name: 'Dashboard',    component: Dashboard,    meta: { requiresAuth: true } },
  { path: '/transactions', name: 'Transactions', component: Transactions, meta: { requiresAuth: true } },
  { path: '/analytics',    name: 'Analytics',    component: Analytics,    meta: { requiresAuth: true } },
  { path: '/login',        name: 'Login',        component: Login,        meta: { guest: true } },
  { path: '/register',     name: 'Register',     component: Register,     meta: { guest: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from) => {
  const isAuthenticated = !!localStorage.getItem('token')
  if (to.meta.requiresAuth && !isAuthenticated) return { name: 'Login' }
  if (to.meta.guest && isAuthenticated)         return { name: 'Dashboard' }
})

export default router
