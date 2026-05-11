import { Request, Response } from 'express';
import oracledb from 'oracledb';
import db from '../db';

interface AccountRow {
  ACCOUNT_ID: number;
  ACCOUNT_NUMBER: string;
  NAME: string;
  TYPE_ID: number;
  TYPE_NAME: string;
}

// ─── GET /api/expenses ─────────────────────────────────────────────────────────
export const getTransactions = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Join debit and credit TransactionLines to reconstruct each transaction
    const sql = `
      SELECT 
        t.transaction_id,
        t.transaction_date,
        t.description,
        t.reference_number,
        t.status,
        da.name        AS debit_account,
        da.account_id  AS debit_account_id,
        ca.name        AS credit_account,
        ca.account_id  AS credit_account_id,
        dl.debit_amount AS amount,
        CASE 
          WHEN da.type_id = 5 AND ca.type_id = 1 THEN 'expense'
          WHEN da.type_id = 1 AND ca.type_id = 4 THEN 'income'
          ELSE 'transfer'
        END AS type
      FROM Transactions t
      JOIN TransactionLines dl ON dl.transaction_id = t.transaction_id AND dl.debit_amount  > 0
      JOIN TransactionLines cl ON cl.transaction_id = t.transaction_id AND cl.credit_amount > 0
      JOIN Accounts da ON dl.account_id = da.account_id
      JOIN Accounts ca ON cl.account_id = ca.account_id
      WHERE t.status != 'VOIDED'
      ORDER BY t.transaction_date DESC, t.transaction_id DESC
      FETCH FIRST 100 ROWS ONLY
    `;
    const result = await db.execute(sql);
    res.json({ success: true, data: result.rows ?? [] });
  } catch (err) {
    console.error('getTransactions error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
};

// ─── GET /api/expenses/:id ─────────────────────────────────────────────────────
export const getTransactionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT 
        t.transaction_id, t.transaction_date, t.description,
        t.reference_number, t.status,
        da.name AS debit_account, da.account_id AS debit_account_id,
        ca.name AS credit_account, ca.account_id AS credit_account_id,
        dl.debit_amount AS amount
      FROM Transactions t
      JOIN TransactionLines dl ON dl.transaction_id = t.transaction_id AND dl.debit_amount  > 0
      JOIN TransactionLines cl ON cl.transaction_id = t.transaction_id AND cl.credit_amount > 0
      JOIN Accounts da ON dl.account_id = da.account_id
      JOIN Accounts ca ON cl.account_id = ca.account_id
      WHERE t.transaction_id = :1
    `;
    const result = await db.execute(sql, [req.params.id]);
    const row = result.rows?.[0];
    if (!row) {
      res.status(404).json({ success: false, message: 'Transaction not found' });
      return;
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('getTransactionById error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch transaction' });
  }
};

// ─── POST /api/expenses ────────────────────────────────────────────────────────
export const createTransaction = async (req: Request, res: Response): Promise<void> => {
  const { description, amount, transaction_date, debit_account_id, credit_account_id, reference_number } = req.body as {
    description: string;
    amount: number;
    transaction_date: string;
    debit_account_id: number;
    credit_account_id: number;
    reference_number?: string;
  };

  if (!description || !amount || !transaction_date || !debit_account_id || !credit_account_id) {
    res.status(400).json({ success: false, message: 'Missing required fields' });
    return;
  }
  if (Number(amount) <= 0) {
    res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    return;
  }

  try {
    // Insert transaction header
    const txResult = await db.execute(
      `INSERT INTO Transactions (transaction_date, description, reference_number, status)
       VALUES (TO_DATE(:1,'YYYY-MM-DD'), :2, :3, 'POSTED')
       RETURNING transaction_id INTO :4`,
      [transaction_date, description, reference_number || null,
       { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }],
      { autoCommit: false }
    );
    const outBinds  = txResult.outBinds as unknown as number[][];
    const transactionId = outBinds[0][0];

    // Debit line
    await db.execute(
      `INSERT INTO TransactionLines (transaction_id, account_id, currency_code, debit_amount, credit_amount, description)
       VALUES (:1, :2, 'USD', :3, 0, :4)`,
      [transactionId, debit_account_id, amount, description],
      { autoCommit: false }
    );

    // Credit line
    await db.execute(
      `INSERT INTO TransactionLines (transaction_id, account_id, currency_code, debit_amount, credit_amount, description)
       VALUES (:1, :2, 'USD', 0, :3, :4)`,
      [transactionId, credit_account_id, amount, description],
      { autoCommit: true }
    );

    res.status(201).json({ success: true, message: 'Transaction created', transactionId });
  } catch (err) {
    console.error('createTransaction error:', err);
    res.status(500).json({ success: false, message: 'Failed to create transaction' });
  }
};

// ─── PUT /api/expenses/:id ─────────────────────────────────────────────────────
export const updateTransaction = async (req: Request, res: Response): Promise<void> => {
  const { description, transaction_date, reference_number, status } = req.body as {
    description?: string;
    transaction_date?: string;
    reference_number?: string;
    status?: string;
  };

  try {
    const result = await db.execute(
      `UPDATE Transactions SET
         description      = NVL(:1, description),
         transaction_date = NVL(TO_DATE(:2,'YYYY-MM-DD'), transaction_date),
         reference_number = NVL(:3, reference_number),
         status           = NVL(:4, status),
         updated_at       = CURRENT_TIMESTAMP
       WHERE transaction_id = :5`,
      [description || null, transaction_date || null,
       reference_number || null, status || null, req.params.id],
      { autoCommit: true }
    );
    if ((result.rowsAffected ?? 0) === 0) {
      res.status(404).json({ success: false, message: 'Transaction not found' });
      return;
    }
    res.json({ success: true, message: 'Transaction updated' });
  } catch (err) {
    console.error('updateTransaction error:', err);
    res.status(500).json({ success: false, message: 'Failed to update transaction' });
  }
};

// ─── DELETE /api/expenses/:id ──────────────────────────────────────────────────
export const deleteTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(
      'DELETE FROM Transactions WHERE transaction_id = :1',
      [req.params.id],
      { autoCommit: true }
    );
    if ((result.rowsAffected ?? 0) === 0) {
      res.status(404).json({ success: false, message: 'Transaction not found' });
      return;
    }
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    console.error('deleteTransaction error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete transaction' });
  }
};

// ─── GET /api/expenses/accounts ───────────────────────────────────────────────
export const getAccounts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(`
      SELECT a.account_id, a.account_number, a.name, a.type_id, aty.name AS type_name
      FROM Accounts a
      JOIN AccountTypes aty ON a.type_id = aty.type_id
      WHERE a.is_active = 1
      ORDER BY a.type_id, a.name
    `);
    res.json({ success: true, data: result.rows ?? [] });
  } catch (err) {
    console.error('getAccounts error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch accounts' });
  }
};

// ─── GET /api/expenses/monthly ────────────────────────────────────────────────
export const getMonthlyExpenses = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT 
        TO_CHAR(t.transaction_date, 'YYYY-MM') AS month,
        SUM(tl.debit_amount) AS total_expense
      FROM TransactionLines tl
      JOIN Accounts a ON tl.account_id = a.account_id
      JOIN Transactions t ON tl.transaction_id = t.transaction_id
      WHERE a.type_id = 5
        AND tl.debit_amount > 0
        AND t.status = 'POSTED'
      GROUP BY TO_CHAR(t.transaction_date, 'YYYY-MM')
      ORDER BY month DESC
      FETCH FIRST 12 ROWS ONLY
    `;
    try {
      const result = await db.execute(sql);
      res.json({ success: true, data: result.rows ?? [] });
    } catch {
      // Fallback mock data if tables don't exist yet
      res.json({
        success: true,
        mocked: true,
        data: [
          { MONTH: '2026-05', TOTAL_EXPENSE: 4500.50 },
          { MONTH: '2026-04', TOTAL_EXPENSE: 3200.00 },
          { MONTH: '2026-03', TOTAL_EXPENSE: 5100.75 },
          { MONTH: '2026-02', TOTAL_EXPENSE: 2800.20 },
          { MONTH: '2026-01', TOTAL_EXPENSE: 3500.00 },
          { MONTH: '2025-12', TOTAL_EXPENSE: 6000.00 }
        ]
      });
    }
  } catch (err) {
    console.error('getMonthlyExpenses error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
