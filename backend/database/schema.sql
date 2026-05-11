-- Personal Finance Management System - Oracle Database Schema (Double-Entry)

-- 1. Currencies Table
CREATE TABLE Currencies (
    currency_code VARCHAR2(3) PRIMARY KEY, -- e.g., USD, IDR, EUR
    name VARCHAR2(50) NOT NULL,
    symbol VARCHAR2(5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Exchange Rates
CREATE TABLE ExchangeRates (
    rate_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    from_currency VARCHAR2(3) REFERENCES Currencies(currency_code),
    to_currency VARCHAR2(3) REFERENCES Currencies(currency_code),
    rate NUMBER(15, 6) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_rate_date UNIQUE (from_currency, to_currency, effective_date)
);

-- 3. Account Types (Asset, Liability, Equity, Revenue, Expense)
CREATE TABLE AccountTypes (
    type_id NUMBER PRIMARY KEY,
    name VARCHAR2(50) NOT NULL,
    normal_balance VARCHAR2(6) CHECK (normal_balance IN ('DEBIT', 'CREDIT')) NOT NULL
);

-- Initialize Account Types
INSERT INTO AccountTypes (type_id, name, normal_balance) VALUES (1, 'Asset', 'DEBIT');
INSERT INTO AccountTypes (type_id, name, normal_balance) VALUES (2, 'Liability', 'CREDIT');
INSERT INTO AccountTypes (type_id, name, normal_balance) VALUES (3, 'Equity', 'CREDIT');
INSERT INTO AccountTypes (type_id, name, normal_balance) VALUES (4, 'Revenue', 'CREDIT');
INSERT INTO AccountTypes (type_id, name, normal_balance) VALUES (5, 'Expense', 'DEBIT');

-- 4. Categories
CREATE TABLE Categories (
    category_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR2(100) NOT NULL,
    description VARCHAR2(255),
    parent_category_id NUMBER REFERENCES Categories(category_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Accounts (Chart of Accounts)
CREATE TABLE Accounts (
    account_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_number VARCHAR2(20) UNIQUE NOT NULL,
    name VARCHAR2(100) NOT NULL,
    type_id NUMBER REFERENCES AccountTypes(type_id) NOT NULL,
    category_id NUMBER REFERENCES Categories(category_id),
    currency_code VARCHAR2(3) REFERENCES Currencies(currency_code) NOT NULL,
    is_active NUMBER(1) DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Transactions (Header)
CREATE TABLE Transactions (
    transaction_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_date DATE NOT NULL,
    description VARCHAR2(255) NOT NULL,
    reference_number VARCHAR2(100),
    status VARCHAR2(20) DEFAULT 'POSTED' CHECK (status IN ('PENDING', 'POSTED', 'VOIDED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Transaction Lines (Double Entry Details: Debits & Credits)
CREATE TABLE TransactionLines (
    line_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_id NUMBER REFERENCES Transactions(transaction_id) ON DELETE CASCADE,
    account_id NUMBER REFERENCES Accounts(account_id) NOT NULL,
    currency_code VARCHAR2(3) REFERENCES Currencies(currency_code) NOT NULL,
    debit_amount NUMBER(15, 4) DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount NUMBER(15, 4) DEFAULT 0 CHECK (credit_amount >= 0),
    exchange_rate NUMBER(15, 6) DEFAULT 1, -- Rate used if currency is different from base
    description VARCHAR2(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_debit_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0)
    )
);

-- 8. Budgets
CREATE TABLE Budgets (
    budget_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id NUMBER REFERENCES Accounts(account_id),
    category_id NUMBER REFERENCES Categories(category_id), -- Budget by account or category
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    budgeted_amount NUMBER(15, 4) NOT NULL,
    currency_code VARCHAR2(3) REFERENCES Currencies(currency_code) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_budget_target CHECK (account_id IS NOT NULL OR category_id IS NOT NULL)
);

-- 9. Recurring Transactions Scheduler
CREATE TABLE RecurringSchedules (
    schedule_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    description VARCHAR2(255) NOT NULL,
    frequency VARCHAR2(20) CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
    next_run_date DATE NOT NULL,
    is_active NUMBER(1) DEFAULT 1 CHECK (is_active IN (0, 1)),
    -- Template data for the transaction header
    template_description VARCHAR2(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE RecurringScheduleLines (
    schedule_line_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id NUMBER REFERENCES RecurringSchedules(schedule_id) ON DELETE CASCADE,
    account_id NUMBER REFERENCES Accounts(account_id) NOT NULL,
    debit_amount NUMBER(15, 4) DEFAULT 0,
    credit_amount NUMBER(15, 4) DEFAULT 0,
    CONSTRAINT check_recurring_debit_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0)
    )
);
