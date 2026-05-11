import { Router } from 'express';
import {
  getMonthlyExpenses,
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getAccounts
} from '../controllers/expensesController';

const router = Router();

router.get('/monthly', getMonthlyExpenses);
router.get('/accounts', getAccounts);
router.get('/', getTransactions);
router.get('/:id', getTransactionById);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
