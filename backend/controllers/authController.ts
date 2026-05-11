import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import oracledb from 'oracledb';
import db from '../db';

interface UserRow {
  USER_ID: number;
  NAME: string;
  PASSWORD_HASH: string;
  ROLE: string;
}

export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body as { name: string; email: string; password: string };

  try {
    // Check if user exists
    const checkSql = `SELECT user_id FROM Users WHERE email = :1`;
    const existing = await db.execute(checkSql, [email]);

    if (existing.rows && existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Email already registered' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user with RETURNING clause
    const insertSql = `
      INSERT INTO Users (name, email, password_hash) 
      VALUES (:1, :2, :3) 
      RETURNING user_id INTO :4
    `;
    const result = await db.execute(
      insertSql,
      [
        name,
        email,
        passwordHash,
        { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      ],
      { autoCommit: true }
    );

    const outBinds = result.outBinds as unknown as number[][];
    const userId = outBinds[0][0];

    res.status(201).json({ success: true, message: 'User registered successfully', userId });

  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  try {
    const sql = `SELECT user_id, name, password_hash, role FROM Users WHERE email = :1`;
    const result = await db.execute(sql, [email]);

    if (!result.rows || result.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0] as unknown as UserRow;
    const isMatch = await bcrypt.compare(password, user.PASSWORD_HASH);

    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Create JWT
    const payload = {
      user: {
        id: user.USER_ID,
        role: user.ROLE
      }
    };

    const secret = process.env.JWT_SECRET || 'supersecretkey_change_me_in_prod';
    const token = jwt.sign(payload, secret, { expiresIn: '1d' });

    res.json({
      success: true,
      token,
      user: { id: user.USER_ID, name: user.NAME, email }
    });

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
