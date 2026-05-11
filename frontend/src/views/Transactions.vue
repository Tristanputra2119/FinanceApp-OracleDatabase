<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import api from '../plugins/api'

interface Account {
  ACCOUNT_ID: number
  ACCOUNT_NUMBER: string
  NAME: string
  TYPE_ID: number
  TYPE_NAME: string
}

interface Transaction {
  TRANSACTION_ID: number
  TRANSACTION_DATE: string
  DESCRIPTION: string
  REFERENCE_NUMBER: string
  STATUS: string
  DEBIT_ACCOUNT: string
  CREDIT_ACCOUNT: string
  DEBIT_ACCOUNT_ID: number
  CREDIT_ACCOUNT_ID: number
  AMOUNT: number
  TYPE: string
}

interface TxForm {
  description: string
  amount: string
  transaction_date: string
  debit_account_id: string
  credit_account_id: string
  reference_number: string
}

// ─── State ────────────────────────────────────────────────────────────────
const transactions = ref<Transaction[]>([])
const accounts     = ref<Account[]>([])
const loading      = ref(false)
const error        = ref('')
const saving       = ref(false)
const deleteId     = ref<number | null>(null)

const showModal  = ref(false)
const editingId  = ref<number | null>(null)
const modalError = ref('')

const form = ref<TxForm>({
  description: '',
  amount: '',
  transaction_date: new Date().toISOString().split('T')[0],
  debit_account_id: '',
  credit_account_id: '',
  reference_number: ''
})

// ─── Computed ─────────────────────────────────────────────────────────────
const modalTitle = computed(() => editingId.value ? 'Edit Transaction' : 'New Transaction')

const assetAccounts   = computed(() => accounts.value.filter(a => a.TYPE_ID === 1))
const expenseAccounts = computed(() => accounts.value.filter(a => a.TYPE_ID === 5))
const allAccounts     = computed(() => accounts.value)

// ─── Helpers ──────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

const fmtDate = (d: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d))

// ─── API calls ────────────────────────────────────────────────────────────
const fetchAll = async () => {
  loading.value = true
  error.value = ''
  try {
    const [txRes, acRes] = await Promise.all([
      api.get<{ success: boolean; data: Transaction[] }>('/expenses'),
      api.get<{ success: boolean; data: Account[] }>('/expenses/accounts')
    ])
    transactions.value = txRes.data.data
    accounts.value     = acRes.data.data
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  editingId.value = null
  form.value = {
    description: '',
    amount: '',
    transaction_date: new Date().toISOString().split('T')[0],
    debit_account_id: '',
    credit_account_id: '',
    reference_number: ''
  }
  modalError.value = ''
  showModal.value = true
}

const openEdit = (tx: Transaction) => {
  editingId.value = tx.TRANSACTION_ID
  form.value = {
    description: tx.DESCRIPTION,
    amount: String(tx.AMOUNT),
    transaction_date: tx.TRANSACTION_DATE?.toString().split('T')[0] ?? '',
    debit_account_id: String(tx.DEBIT_ACCOUNT_ID),
    credit_account_id: String(tx.CREDIT_ACCOUNT_ID),
    reference_number: tx.REFERENCE_NUMBER ?? ''
  }
  modalError.value = ''
  showModal.value = true
}

const saveTransaction = async () => {
  modalError.value = ''
  if (!form.value.description || !form.value.amount || !form.value.transaction_date) {
    modalError.value = 'Please fill all required fields.'
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await api.put(`/expenses/${editingId.value}`, {
        description:      form.value.description,
        transaction_date: form.value.transaction_date,
        reference_number: form.value.reference_number || undefined
      })
    } else {
      await api.post('/expenses', {
        description:       form.value.description,
        amount:            Number(form.value.amount),
        transaction_date:  form.value.transaction_date,
        debit_account_id:  Number(form.value.debit_account_id),
        credit_account_id: Number(form.value.credit_account_id),
        reference_number:  form.value.reference_number || undefined
      })
    }
    showModal.value = false
    await fetchAll()
  } catch (e) {
    modalError.value = (e as { response?: { data?: { message?: string } } }).response?.data?.message || (e as Error).message
  } finally {
    saving.value = false
  }
}

const confirmDelete = async (id: number) => {
  if (!confirm('Delete this transaction? This cannot be undone.')) return
  deleteId.value = id
  try {
    await api.delete(`/expenses/${id}`)
    transactions.value = transactions.value.filter(t => t.TRANSACTION_ID !== id)
  } catch (e) {
    alert('Failed to delete: ' + (e as Error).message)
  } finally {
    deleteId.value = null
  }
}

onMounted(fetchAll)
</script>

<template>
  <div>
    <!-- Header -->
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
      <div>
        <h1 style="font-size:20px; font-weight:700;">Transactions</h1>
        <p style="color:#64748b; margin-top:2px;">Manage your financial transactions</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        New Transaction
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px 16px;color:#fca5a5;margin-bottom:16px;font-size:13px;">
      {{ error }}
    </div>

    <!-- Table card -->
    <div class="card">
      <!-- Loading skeleton -->
      <div v-if="loading" style="padding:20px;">
        <div v-for="i in 8" :key="i" style="display:flex; gap:16px; margin-bottom:14px; align-items:center;">
          <div style="height:13px; flex:2; background:#334155; border-radius:4px;"></div>
          <div style="height:13px; flex:1; background:#1e293b; border-radius:4px;"></div>
          <div style="height:13px; flex:1; background:#334155; border-radius:4px;"></div>
          <div style="height:13px; width:70px; background:#1e293b; border-radius:4px;"></div>
          <div style="height:13px; width:80px; background:#334155; border-radius:4px;"></div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="transactions.length === 0" style="padding:60px 20px; text-align:center; color:#475569;">
        <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#334155" stroke-width="1.5" style="margin:0 auto 12px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p style="margin-bottom:8px;">No transactions found</p>
        <button class="btn btn-primary btn-sm" @click="openCreate">Add first transaction</button>
      </div>

      <!-- Table -->
      <table v-else class="table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Date</th>
            <th>Debit Account</th>
            <th>Credit Account</th>
            <th>Status</th>
            <th style="text-align:right;">Amount</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in transactions" :key="tx.TRANSACTION_ID">
            <td>
              <p style="font-weight:500;">{{ tx.DESCRIPTION }}</p>
              <p v-if="tx.REFERENCE_NUMBER" style="font-size:12px; color:#64748b;">{{ tx.REFERENCE_NUMBER }}</p>
            </td>
            <td style="color:#94a3b8; font-size:13px; white-space:nowrap;">{{ fmtDate(tx.TRANSACTION_DATE) }}</td>
            <td style="font-size:13px; color:#94a3b8;">{{ tx.DEBIT_ACCOUNT }}</td>
            <td style="font-size:13px; color:#94a3b8;">{{ tx.CREDIT_ACCOUNT }}</td>
            <td>
              <span :class="['badge', tx.STATUS === 'POSTED' ? 'badge-green' : tx.STATUS === 'PENDING' ? 'badge-yellow' : 'badge-red']">
                {{ tx.STATUS }}
              </span>
            </td>
            <td style="text-align:right; font-weight:600; white-space:nowrap;"
              :style="{ color: tx.TYPE === 'income' ? '#4ade80' : tx.TYPE === 'expense' ? '#f87171' : '#94a3b8' }">
              {{ fmt(tx.AMOUNT) }}
            </td>
            <td style="text-align:right; white-space:nowrap;">
              <button class="btn btn-ghost btn-sm" @click="openEdit(tx)" style="margin-right:6px;">
                Edit
              </button>
              <button
                class="btn btn-danger btn-sm"
                @click="confirmDelete(tx.TRANSACTION_ID)"
                :disabled="deleteId === tx.TRANSACTION_ID"
              >
                {{ deleteId === tx.TRANSACTION_ID ? '...' : 'Delete' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal">
          <!-- Modal header -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
            <h2 style="font-size:16px; font-weight:600;">{{ modalTitle }}</h2>
            <button @click="showModal = false" style="background:none; border:none; cursor:pointer; color:#64748b; padding:4px;">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Modal error -->
          <div v-if="modalError" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px 12px;color:#fca5a5;margin-bottom:16px;font-size:13px;">
            {{ modalError }}
          </div>

          <form @submit.prevent="saveTransaction" style="display:flex; flex-direction:column; gap:14px;">

            <!-- Description -->
            <div>
              <label style="display:block; font-size:13px; color:#94a3b8; margin-bottom:5px;">Description *</label>
              <input v-model="form.description" type="text" required class="input" placeholder="e.g. Office supplies" />
            </div>

            <!-- Amount + Date -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="display:block; font-size:13px; color:#94a3b8; margin-bottom:5px;">Amount *</label>
                <input
                  v-model="form.amount"
                  type="number" min="0.01" step="0.01" required
                  class="input"
                  placeholder="0.00"
                  :disabled="!!editingId"
                />
              </div>
              <div>
                <label style="display:block; font-size:13px; color:#94a3b8; margin-bottom:5px;">Date *</label>
                <input v-model="form.transaction_date" type="date" required class="input" />
              </div>
            </div>

            <!-- Accounts (only for new) -->
            <template v-if="!editingId">
              <div>
                <label style="display:block; font-size:13px; color:#94a3b8; margin-bottom:5px;">Debit Account * <span style="color:#475569;">(what gets charged)</span></label>
                <select v-model="form.debit_account_id" required class="input">
                  <option value="">Select account...</option>
                  <optgroup v-for="typeId in [1,2,3,4,5]" :key="typeId"
                    :label="accounts.find(a=>a.TYPE_ID===typeId)?.TYPE_NAME ?? ''">
                    <option v-for="a in accounts.filter(ac=>ac.TYPE_ID===typeId)" :key="a.ACCOUNT_ID" :value="a.ACCOUNT_ID">
                      {{ a.ACCOUNT_NUMBER }} — {{ a.NAME }}
                    </option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label style="display:block; font-size:13px; color:#94a3b8; margin-bottom:5px;">Credit Account * <span style="color:#475569;">(what gets credited)</span></label>
                <select v-model="form.credit_account_id" required class="input">
                  <option value="">Select account...</option>
                  <optgroup v-for="typeId in [1,2,3,4,5]" :key="typeId"
                    :label="accounts.find(a=>a.TYPE_ID===typeId)?.TYPE_NAME ?? ''">
                    <option v-for="a in accounts.filter(ac=>ac.TYPE_ID===typeId)" :key="a.ACCOUNT_ID" :value="a.ACCOUNT_ID">
                      {{ a.ACCOUNT_NUMBER }} — {{ a.NAME }}
                    </option>
                  </optgroup>
                </select>
              </div>
            </template>

            <!-- Reference -->
            <div>
              <label style="display:block; font-size:13px; color:#94a3b8; margin-bottom:5px;">Reference No. <span style="color:#475569;">(optional)</span></label>
              <input v-model="form.reference_number" type="text" class="input" placeholder="e.g. INV-2026-001" />
            </div>

            <!-- Actions -->
            <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:4px;">
              <button type="button" class="btn btn-ghost" @click="showModal = false">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <svg v-if="saving" class="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {{ saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Transaction') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
