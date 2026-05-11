const fs = require('fs');
const path = require('path');

const files = [
  'C:/Users/Admin/Documents/belajar-oracle/backend/db.ts',
  'C:/Users/Admin/Documents/belajar-oracle/backend/migrate.ts',
  'C:/Users/Admin/Documents/belajar-oracle/backend/migrateAuth.ts',
  'C:/Users/Admin/Documents/belajar-oracle/backend/seed.ts',
  'C:/Users/Admin/Documents/belajar-oracle/backend/server.ts',
  'C:/Users/Admin/Documents/belajar-oracle/backend/controllers/authController.ts',
  'C:/Users/Admin/Documents/belajar-oracle/backend/controllers/dashboardController.ts',
  'C:/Users/Admin/Documents/belajar-oracle/backend/controllers/expensesController.ts',
  'C:/Users/Admin/Documents/belajar-oracle/backend/middleware/authMiddleware.ts',
  'C:/Users/Admin/Documents/belajar-oracle/backend/routes/auth.ts',
  'C:/Users/Admin/Documents/belajar-oracle/backend/routes/dashboard.ts',
  'C:/Users/Admin/Documents/belajar-oracle/backend/routes/expenses.ts'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace const x = require('y') with import x from 'y'
  content = content.replace(/const\s+([a-zA-Z0-9_]+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, "import $1 from '$2';");
  
  // Replace module.exports = x with export default x
  content = content.replace(/module\.exports\s*=\s*/g, "export default ");
  
  // Replace exports.x = with export const x =
  content = content.replace(/exports\.([a-zA-Z0-9_]+)\s*=\s*/g, "export const $1 = ");
  
  fs.writeFileSync(file, content);
});
console.log('Conversion script finished.');
