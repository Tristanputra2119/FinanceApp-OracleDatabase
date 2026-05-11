import { Request, Response } from 'express';
import db from '../db';

interface AssetRow    { BALANCE: number; }
interface ExpenseRow  { TOTAL_EXPENSE: number; }
interface IncomeRow   { TOTAL_INCOME: number; }
interface TxRow {
  TRANSACTION_ID: number;
  TRANSACTION_DATE: Date;
  AMOUNT: number;
  DESCRIPTION: string;
  REFERENCE_NUMBER: string;
  DEBIT_ACCOUNT: string;
  CREDIT_ACCOUNT: string;
  DEBIT_TYPE_ID: number;
  CREDIT_TYPE_ID: number;
}

export const getSummary = async (_req: Request, res: Response): Promise<void> => {
  try {

    // ── 1. Current Balance = sum of Asset account net debits ─────────────
    // Asset accounts: normal balance is DEBIT → balance = total_debit - total_credit on asset lines
    const assetSql = `
      SELECT NVL(
        SUM(tl.debit_amount) - SUM(tl.credit_amount)
      , 0) AS balance
      FROM TransactionLines tl
      JOIN Accounts a ON tl.account_id = a.account_id
      JOIN Transactions t ON tl.transaction_id = t.transaction_id
      WHERE a.type_id = 1
        AND t.status = 'POSTED'
    `;
    const assetResult = await db.execute(assetSql);
    const assetRow = assetResult.rows?.[0] as unknown as AssetRow | undefined;
    const currentBalance = assetRow?.BALANCE ?? 0;

    // ── 2. Monthly Expense (type_id=5, debit lines only, current month) ──
    const expenseSql = `
      SELECT NVL(SUM(tl.debit_amount), 0) AS total_expense
      FROM TransactionLines tl
      JOIN Accounts a ON tl.account_id = a.account_id
      JOIN Transactions t ON tl.transaction_id = t.transaction_id
      WHERE a.type_id = 5
        AND tl.debit_amount > 0
        AND t.status = 'POSTED'
        AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM SYSDATE)
        AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM SYSDATE)
    `;
    const expenseResult = await db.execute(expenseSql);
    const expRow = expenseResult.rows?.[0] as unknown as ExpenseRow | undefined;
    const monthlyExpense = expRow?.TOTAL_EXPENSE ?? 0;

    // ── 3. Monthly Income (type_id=4, credit lines only, current month) ──
    const incomeSql = `
      SELECT NVL(SUM(tl.credit_amount), 0) AS total_income
      FROM TransactionLines tl
      JOIN Accounts a ON tl.account_id = a.account_id
      JOIN Transactions t ON tl.transaction_id = t.transaction_id
      WHERE a.type_id = 4
        AND tl.credit_amount > 0
        AND t.status = 'POSTED'
        AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM SYSDATE)
        AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM SYSDATE)
    `;
    const incomeResult = await db.execute(incomeSql);
    const incRow = incomeResult.rows?.[0] as unknown as IncomeRow | undefined;
    const monthlyIncome = incRow?.TOTAL_INCOME ?? 0;

    // ── 4. Recent 5 Transactions ─────────────────────────────────────────
    // Join debit and credit lines to get both accounts per transaction
    const recentSql = `
      SELECT 
        t.transaction_id,
        t.transaction_date,
        t.description,
        t.reference_number,
        dl.debit_amount AS amount,
        da.name AS debit_account,
        ca.name AS credit_account,
        da.type_id AS debit_type_id,
        ca.type_id AS credit_type_id
      FROM Transactions t
      JOIN TransactionLines dl ON dl.transaction_id = t.transaction_id AND dl.debit_amount  > 0
      JOIN TransactionLines cl ON cl.transaction_id = t.transaction_id AND cl.credit_amount > 0
      JOIN Accounts da ON dl.account_id = da.account_id
      JOIN Accounts ca ON cl.account_id = ca.account_id
      WHERE t.status = 'POSTED'
      ORDER BY t.transaction_date DESC, t.transaction_id DESC
      FETCH FIRST 5 ROWS ONLY
    `;
    const recentResult = await db.execute(recentSql);
    const rows = (recentResult.rows ?? []) as unknown as TxRow[];

    const recentTransactions = rows.map((row) => {
      // income: debit=Asset(1), credit=Revenue(4)
      // expense: debit=Expense(5), credit=Asset(1)
      const type =
        row.DEBIT_TYPE_ID === 1 && row.CREDIT_TYPE_ID === 4 ? 'income' :
        row.DEBIT_TYPE_ID === 5 && row.CREDIT_TYPE_ID === 1 ? 'expense' : 'transfer';

      return {
        id:          row.TRANSACTION_ID,
        date:        row.TRANSACTION_DATE,
        amount:      row.AMOUNT,
        description: row.DESCRIPTION,
        reference:   row.REFERENCE_NUMBER,
        type,
        category:    type === 'income' ? row.CREDIT_ACCOUNT : row.DEBIT_ACCOUNT,
      };
    });

    res.json({
      success: true,
      data: { currentBalance, monthlyIncome, monthlyExpense, recentTransactions }
    });

  } catch (error) {
    console.error('Dashboard Summary Error:', error);
    res.status(500).json({ success: false, message: 'Server Error fetching dashboard summary' });
  }
};
