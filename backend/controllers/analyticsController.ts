import { Request, Response } from 'express';
import db from '../db';

interface MonthRow {
  MONTH_LABEL: string;
  RN: number;
  EXPENSE: number;
  INCOME: number;
  EXP_SLOPE: number;
  EXP_INTERCEPT: number;
  INC_SLOPE: number;
  INC_INTERCEPT: number;
  R_SQUARED: number;
  MAX_RN: number;
}

/**
 * GET /api/analytics/chart
 * Returns 12-month income vs expense data + Oracle linear regression coefficients.
 * Uses Oracle's REGR_SLOPE / REGR_INTERCEPT / REGR_R2 aggregate functions.
 */
export const getChartData = async (_req: Request, res: Response): Promise<void> => {
  try {
    /**
     * Oracle SQL breakdown:
     *   months     → generate last 12 calendar months via CONNECT BY LEVEL
     *   actuals    → aggregate expense (type_id=5 debit) & income (type_id=4 credit) per month
     *   merged     → left-join so months with no data still appear as 0
     *   regression → Oracle REGR_* aggregate over merged rows
     * Final SELECT returns per-month data + regression coefficients repeated on each row.
     */
    const sql = `
      WITH months AS (
        SELECT
          ADD_MONTHS(TRUNC(SYSDATE,'MM'), -(12 - LEVEL)) AS month_start,
          TO_CHAR(ADD_MONTHS(TRUNC(SYSDATE,'MM'), -(12 - LEVEL)), 'YYYY-MM') AS month_label
        FROM DUAL
        CONNECT BY LEVEL <= 12
      ),
      actuals AS (
        SELECT
          TO_CHAR(t.transaction_date, 'YYYY-MM') AS month_label,
          SUM(CASE WHEN a.type_id = 5 AND tl.debit_amount  > 0 THEN tl.debit_amount  ELSE 0 END) AS expense,
          SUM(CASE WHEN a.type_id = 4 AND tl.credit_amount > 0 THEN tl.credit_amount ELSE 0 END) AS income
        FROM Transactions t
        JOIN TransactionLines tl ON tl.transaction_id = t.transaction_id
        JOIN Accounts         a  ON tl.account_id     = a.account_id
        WHERE t.status = 'POSTED'
          AND t.transaction_date >= ADD_MONTHS(TRUNC(SYSDATE,'MM'), -12)
        GROUP BY TO_CHAR(t.transaction_date, 'YYYY-MM')
      ),
      merged AS (
        SELECT
          m.month_label,
          m.month_start,
          ROW_NUMBER() OVER (ORDER BY m.month_start) AS rn,
          NVL(a.expense, 0) AS expense,
          NVL(a.income,  0) AS income
        FROM months m
        LEFT JOIN actuals a ON a.month_label = m.month_label
      ),
      regression AS (
        SELECT
          REGR_SLOPE(expense, rn)     AS exp_slope,
          REGR_INTERCEPT(expense, rn) AS exp_intercept,
          REGR_SLOPE(income,  rn)     AS inc_slope,
          REGR_INTERCEPT(income,  rn) AS inc_intercept,
          REGR_R2(expense, rn)        AS r_squared,
          MAX(rn)                     AS max_rn
        FROM merged
        WHERE expense > 0 OR income > 0
      )
      SELECT
        m.month_label,
        m.rn,
        m.expense,
        m.income,
        NVL(r.exp_slope,     0) AS exp_slope,
        NVL(r.exp_intercept, 0) AS exp_intercept,
        NVL(r.inc_slope,     0) AS inc_slope,
        NVL(r.inc_intercept, 0) AS inc_intercept,
        NVL(r.r_squared,     0) AS r_squared,
        NVL(r.max_rn,       12) AS max_rn
      FROM merged m, regression r
      ORDER BY m.rn
    `;

    const result = await db.execute(sql);
    const rows = (result.rows ?? []) as unknown as MonthRow[];

    if (rows.length === 0) {
      res.json({ success: true, data: { months: [], prediction: null } });
      return;
    }

    // Build monthly series (historical)
    const months = rows.map(r => ({
      label:   r.MONTH_LABEL,
      expense: Number(r.EXPENSE ?? 0),
      income:  Number(r.INCOME  ?? 0),
    }));

    // Extract regression coefficients from last row (same on all)
    const last       = rows[rows.length - 1];
    const expSlope   = Number(last.EXP_SLOPE ?? 0);
    const expInt     = Number(last.EXP_INTERCEPT ?? 0);
    const incSlope   = Number(last.INC_SLOPE ?? 0);
    const incInt     = Number(last.INC_INTERCEPT ?? 0);
    const rSquared   = Number(last.R_SQUARED ?? 0);
    const maxRn      = Number(last.MAX_RN ?? 12);

    // Generate predicted next 3 months (y = slope * x + intercept)
    const lastLabel   = rows[rows.length - 1].MONTH_LABEL;
    const lastDate    = new Date(lastLabel + '-01');

    const nextMonths = [1, 2, 3].map(n => {
      const d = new Date(lastDate);
      d.setMonth(d.getMonth() + n);
      const label = d.toISOString().slice(0, 7);
      const x = maxRn + n;
      return {
        label,
        predicted_expense: Math.max(0, Math.round(expSlope * x + expInt)),
        predicted_income:  Math.max(0, Math.round(incSlope  * x + incInt)),
      };
    });

    // Trend: positive slope = increasing, negative = decreasing
    const trend =
      expSlope >  50 ? 'increasing' :
      expSlope < -50 ? 'decreasing' : 'stable';

    const avgExpense = months.reduce((s, m) => s + m.expense, 0) / months.length;

    res.json({
      success: true,
      data: {
        months,
        prediction: {
          r_squared:   Number(rSquared.toFixed(4)),
          confidence:  Math.min(100, Math.round(Math.abs(rSquared) * 100)),
          trend,
          exp_slope:   Number(expSlope.toFixed(2)),
          avg_expense: Math.round(avgExpense),
          next_months: nextMonths,
        },
      },
    });
  } catch (err) {
    console.error('getChartData error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics data' });
  }
};

/**
 * GET /api/analytics/category-breakdown
 * Expense breakdown by account/category for current month.
 */
export const getCategoryBreakdown = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT
        a.name           AS category,
        SUM(tl.debit_amount) AS total
      FROM TransactionLines tl
      JOIN Accounts     a ON tl.account_id     = a.account_id
      JOIN Transactions t ON tl.transaction_id = t.transaction_id
      WHERE a.type_id = 5
        AND tl.debit_amount > 0
        AND t.status = 'POSTED'
        AND EXTRACT(YEAR  FROM t.transaction_date) = EXTRACT(YEAR  FROM SYSDATE)
        AND EXTRACT(MONTH FROM t.transaction_date) = EXTRACT(MONTH FROM SYSDATE)
      GROUP BY a.name
      ORDER BY total DESC
    `;
    const result = await db.execute(sql);
    res.json({ success: true, data: result.rows ?? [] });
  } catch (err) {
    console.error('getCategoryBreakdown error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch category breakdown' });
  }
};
