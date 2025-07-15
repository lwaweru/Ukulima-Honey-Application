require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./db');

async function createAdmin() {
  const name = 'Admin1';
  const email = 'ukulimaAdmin@gmail.com';  // change to your admin email
  const password = 'lewis3694!';         // same password
  const role = 'admin';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = 'INSERT INTO customers (name, email, password, role) VALUES (?, ?, ?, ?)';

    db.query(sql, [name, email, hashedPassword, role], (err, result) => {
      if (err) {
        console.error('Error creating admin:', err);
      } else {
        console.log('Admin created successfully.');
      }
      process.exit();
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

createAdmin();
