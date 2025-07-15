require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('Ukulima Honey Backend is running!');
});
// === Serve Login Page ===
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'SignIn.html'));
});

// === Auth: Signup ===
app.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required' });
  }

  const normalizedRole = role === 'Admin' ? 'Admin' : 'Customer';
  const checkQuery = 'SELECT * FROM customers WHERE email = ?';

  db.query(checkQuery, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length > 0) return res.status(409).json({ message: 'Email already registered' });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const insertQuery = 'INSERT INTO customers (name, email, password, role) VALUES (?, ?, ?, ?)';
      db.query(insertQuery, [name, email, hashedPassword, normalizedRole], (err) => {
        if (err) return res.status(500).json({ message: 'Error inserting user' });
        res.status(201).json({ message: 'User registered successfully' });
      });
    } catch {
      res.status(500).json({ message: 'Error hashing password' });
    }
  });
});

// === Auth: Login ===
app.post('/login', (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Email, password, and role are required' });
  }

  const query = 'SELECT * FROM customers WHERE email = ? AND role = ?';
  db.query(query, [email, role], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(401).json({ message: 'Invalid credentials or role' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const updateLastActive = 'UPDATE customers SET last_active = NOW(), status = "Active" WHERE customer_id = ?';
    db.query(updateLastActive, [user.customer_id]);

    res.status(200).json({
      message: `${user.role} login successful`,
      user: {
        email: user.email,
        role: user.role,
        customer_id: user.customer_id
      }
    });
  });
});

// === Auth: Request Password Reset ===
app.post('/api/request-reset', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const query = 'SELECT * FROM customers WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(404).json({ message: 'No user with that email' });

    const token = crypto.randomBytes(32).toString('hex');
    const expireTime = Date.now() + 3600000;

    const updateQuery = 'UPDATE customers SET reset_token = ?, reset_token_expire = ? WHERE email = ?';
    db.query(updateQuery, [token, expireTime, email], (err) => {
      if (err) return res.status(500).json({ message: 'Error saving reset token' });

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const resetLink = `http://localhost:3000/SetNewPassword.html?token=${token}&email=${encodeURIComponent(email)}`;
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Ukulima Honey Password Reset',
        html: `<p>You requested a password reset</p>
               <p>Click <a href="${resetLink}">here</a> to reset your password.</p>
               <p>This link will expire in 1 hour.</p>`
      };

      transporter.sendMail(mailOptions, (err) => {
        if (err) return res.status(500).json({ message: 'Failed to send email' });
        res.json({ message: 'Password reset email sent' });
      });
    });
  });
});

// === Auth: Reset Password ===
app.post('/api/reset-password', (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const query = 'SELECT * FROM customers WHERE email = ? AND reset_token = ? AND reset_token_expire > ?';
  db.query(query, [email, token, Date.now()], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (results.length === 0) return res.status(400).json({ message: 'Invalid or expired token' });

    bcrypt.hash(newPassword, 10, (err, hashed) => {
      if (err) return res.status(500).json({ message: 'Hashing failed' });

      const update = 'UPDATE customers SET password = ?, reset_token = NULL, reset_token_expire = NULL WHERE email = ?';
      db.query(update, [hashed, email], (err) => {
        if (err) return res.status(500).json({ message: 'Failed to reset password' });
        res.json({ message: 'Password updated successfully' });
      });
    });
  });
});

// === Customers API (converted from async/await to callback) ===
app.get('/api/customers', (req, res) => {
  const { email, name } = req.query;
  let sql = `
    SELECT 
      customer_id, name, email, role, last_active,
      CASE 
        WHEN last_active IS NOT NULL AND last_active >= NOW() - INTERVAL 7 DAY THEN 'Active'
        ELSE 'Inactive'
      END AS status
    FROM customers
  `;
  const params = [];

  if (email) {
    sql += ' WHERE email = ?';
    params.push(email);
  } else if (name) {
    sql += ' WHERE name = ?';
    params.push(name);
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch customers' });
    res.status(200).json(results);
  });
});

app.delete('/api/customers/:id', (req, res) => {
  const customerId = req.params.id;

  db.query('SELECT COUNT(*) AS saleCount FROM sales WHERE customer_id = ?', [customerId], (err, salesResults) => {
    if (err) return res.status(500).json({ message: 'Server error checking sales' });

    if (salesResults[0].saleCount > 0) {
      return res.status(400).json({ message: 'Cannot delete customer with existing sales records.' });
    }

    db.query('DELETE FROM customers WHERE customer_id = ?', [customerId], (err, result) => {
      if (err) return res.status(500).json({ message: 'Server error deleting customer' });

      if (result.affectedRows > 0) {
        res.json({ message: 'Customer deleted successfully.' });
      } else {
        res.status(404).json({ message: 'Customer not found.' });
      }
    });
  });
});

// === Products API ===
app.get('/api/products', (req, res) => {
  db.query(
    'SELECT product_id, product_type, volume_ml, price_per_unit FROM products',
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Failed to fetch products' });
      res.status(200).json(results);
    }
  );
});

app.get('/api/products/:id', (req, res) => {
  db.query('SELECT * FROM products WHERE product_id = ?', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch product' });
    if (results.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(results[0]);
  });
});

// === Inventory API ===
app.get('/api/inventory', (req, res) => {
  const sql = `
    SELECT i.product_id, p.product_type, p.volume_ml, i.stock_quantity, i.last_updated
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error while fetching inventory' });
    res.status(200).json(results);
  });
});

app.post('/api/inventory/update', (req, res) => {
  const { product_id, stock_quantity } = req.body;
  if (!product_id || stock_quantity == null) {
    return res.status(400).json({ message: 'product_id and stock_quantity required' });
  }

  db.query(
    'UPDATE inventory SET stock_quantity = stock_quantity + ?, last_updated = NOW() WHERE product_id = ?',
    [stock_quantity, product_id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Failed to update inventory' });
      res.status(200).json({ message: 'Inventory updated successfully' });
    }
  );
});

// === Sales API ===
app.post('/api/sales', (req, res) => {
  const {
    customerName, contactNumber, number_quantity, volume_quantity,
    totalPrice, date, customer_id, honey_type, county
  } = req.body;

  if (!customerName || !contactNumber || !number_quantity || !volume_quantity || !totalPrice || !date || !customer_id || !honey_type || !county) {
    return res.status(400).json({ message: 'All sale fields are required including county' });
  }

  const getNextReceiptQuery = `SELECT MAX(receipt_number) AS last FROM sales WHERE receipt_number REGEXP '^UH-[0-9]+$'`;
  db.query(getNextReceiptQuery, (err, results) => {
    if (err) return res.status(500).json({ message: 'Could not generate receipt number' });

    let nextNumber = results[0].last ? parseInt(results[0].last.split('-')[1]) + 1 : 1;
    const receiptNumber = `UH-${nextNumber.toString().padStart(3, '0')}`;

    const insertQuery = `
      INSERT INTO sales 
      (customer_name, contact_number, number_quantity, volume_quantity, total_price, receipt_number, sale_date, customer_id, honey_type, county)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [customerName, contactNumber, number_quantity, volume_quantity, totalPrice, receiptNumber, date, customer_id, honey_type, county];

    db.query(insertQuery, values, (err, result) => {
      if (err) return res.status(500).json({ message: 'Failed to record sale', error: err.message });

      const totalMlToDeduct = number_quantity * volume_quantity;
      const honeyTypeFull = {
        raw: 'Raw Honey',
        processed: 'Processed Honey',
        herbal: 'Herbal Honey'
      }[honey_type.trim().toLowerCase()] || honey_type;

      const inventoryQuery = `
        SELECT i.product_id, i.stock_quantity, p.volume_ml
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        WHERE LOWER(p.product_type) = ? AND i.stock_quantity > 0
        ORDER BY i.product_id ASC`;

      db.query(inventoryQuery, [honeyTypeFull.toLowerCase()], (err, items) => {
        if (err) return res.status(500).json({ message: 'Failed to access inventory' });

        let remainingMl = totalMlToDeduct;
        const updatePromises = [];

        for (const item of items) {
          if (remainingMl <= 0) break;

          const totalItemMl = item.stock_quantity * item.volume_ml;
          const deductMl = Math.min(remainingMl, totalItemMl);
          const unitsToDeduct = Math.ceil(deductMl / item.volume_ml);
          const newQty = Math.max(item.stock_quantity - unitsToDeduct, 0);

          updatePromises.push(new Promise((resolve, reject) => {
            db.query(
              'UPDATE inventory SET stock_quantity = ?, last_updated = NOW() WHERE product_id = ?',
              [newQty, item.product_id],
              (err) => err ? reject(err) : resolve()
            );
          }));

          remainingMl -= deductMl;
        }

        Promise.all(updatePromises)
          .then(() => {
            res.status(201).json({
              message: 'Sale recorded and inventory updated',
              saleId: result.insertId,
              receiptNumber
            });
          })
          .catch(err => res.status(500).json({ message: 'Inventory update error', error: err.message }));
      });
    });
  });
});

// === Sales Report API ===
app.get('/api/sales/report', (req, res) => {
  const { startDate, endDate, honeyType, county, customerName } = req.query;

  let sql = `
    SELECT 
      s.receipt_number, s.customer_name, s.contact_number, s.honey_type,
      s.number_quantity, s.volume_quantity,
      (s.number_quantity * s.volume_quantity) AS total_volume,
      s.total_price, s.county,
      DATE_FORMAT(s.sale_date, '%Y-%m-%d') AS sale_date,
      p.price_per_unit, p.cost_per_unit,
      ROUND((p.price_per_unit - p.cost_per_unit) * s.number_quantity, 2) AS profit
    FROM sales s
    JOIN products p
      ON TRIM(LOWER(CONCAT(s.honey_type, ' honey'))) = TRIM(LOWER(p.product_type))
      AND s.volume_quantity = p.volume_ml
    WHERE 1 = 1
  `;

  const params = [];

  if (startDate && endDate) {
    sql += ' AND DATE(s.sale_date) BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  if (honeyType) {
    sql += ' AND LOWER(s.honey_type) = ?';
    params.push(honeyType.toLowerCase());
  }

  if (county) {
    sql += ' AND s.county = ?';
    params.push(county);
  }

  if (customerName) {
    sql += ' AND LOWER(TRIM(s.customer_name)) LIKE LOWER(TRIM(?))';
    params.push(`%${customerName}%`);
  }

  sql += ' ORDER BY CAST(SUBSTRING_INDEX(s.receipt_number, "-", -1) AS UNSIGNED) DESC';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch report', error: err.message });

    let totalRevenue = 0;
    let totalVolume = 0;

    results.forEach(sale => {
      totalRevenue += parseFloat(sale.total_price) || 0;
      totalVolume += parseFloat(sale.total_volume) || 0;
    });

    res.status(200).json({
      data: results,
      summary: {
        totalRevenue,
        totalVolume
      }
    });
  });
});

// === Remarks API ===
app.post('/api/remarks', (req, res) => {
  const { customer_email, remark } = req.body;
  if (!customer_email || !remark) {
    return res.status(400).json({ error: 'Missing email or remark.' });
  }

  db.query('INSERT INTO remarks (customer_email, remark) VALUES (?, ?)', [customer_email, remark], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to submit remark' });
    res.status(200).json({ message: 'Remark submitted successfully' });
  });
});

app.get('/api/remarks', (req, res) => {
  const { email } = req.query;

  const query = email
    ? 'SELECT * FROM remarks WHERE customer_email = ? ORDER BY created_at DESC'
    : 'SELECT * FROM remarks ORDER BY created_at DESC';

  const params = email ? [email] : [];

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch remarks' });
    res.status(200).json(results);
  });
});


app.post('/update-remark', (req, res) => {
  const { remark, id } = req.body;

  db.query('UPDATE your_table SET remark = ? WHERE id = ?', [remark, id], (err, result) => {
    if (err) {
      console.error('❌ Failed to update remark:', err);
      return res.status(500).json({ error: 'Failed to update remark' });
    }
    res.status(200).json({ message: 'Remark updated successfully' });
  });
});

app.post('/api/remarks/like/:id', (req, res) => {
  const { id } = req.params;
  const { response } = req.body;

  const feedback = response?.trim() || "Admin has liked your remark and will take action as expected.";

  db.query("UPDATE remarks SET liked = 1, response = ? WHERE id = ?", [feedback, id], (err) => {
    if (err) {
      console.error("❌ Failed to update remark:", err);
      return res.status(500).json({ error: 'Error liking remark.' });
    }
    res.status(200).json({ message: 'Remark liked successfully' });
  });
});





app.delete('/api/remarks/:id', (req, res) => {
  const id = req.params.id;

  db.query('SELECT liked FROM remarks WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to check remark' });
    if (results.length === 0) return res.status(404).json({ error: 'Remark not found' });

    if (!results[0].liked) {
      return res.status(403).json({ error: 'Only liked remarks can be deleted' });
    }

    db.query('DELETE FROM remarks WHERE id = ?', [id], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to delete remark' });
      res.status(200).json({ message: 'Remark deleted successfully' });
    });
  });
});


// === Pending Orders API ===

// Save a new pending order
app.post('/api/pending-orders', (req, res) => {
  const { name, phone, county, type, quantity, volume, total_volume, total_price } = req.body;

  if (!name || !phone || !county || !type || !quantity || !volume || !total_volume || !total_price) {
    return res.status(400).json({ message: 'All order fields are required' });
  }

  const insertQuery = `
    INSERT INTO pending_orders 
    (name, phone, county, type, quantity, volume, total_volume, total_price, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  const values = [name, phone, county, type, quantity, volume, total_volume, total_price];

  db.query(insertQuery, values, (err, result) => {
    if (err) {
      console.error('Failed to save order:', err);
      return res.status(500).json({ message: 'Database error saving order' });
    }
    // After insertion, fetch the created_at timestamp
const selectQuery = 'SELECT created_at FROM pending_orders WHERE id = ? LIMIT 1';
db.query(selectQuery, [result.insertId], (err2, rows) => {
  if (err2) {
    console.error('Failed to fetch created_at:', err2);
    return res.status(500).json({ message: 'Order saved but failed to retrieve timestamp' });
  }
  const created_at = rows[0]?.created_at;
  res.status(201).json({ 
    message: 'Order saved', 
    id: result.insertId,
    created_at
  });
});
  });
});

// Fetch all pending orders
app.get('/api/pending-orders', (req, res) => {
  db.query('SELECT * FROM pending_orders ORDER BY created_at DESC', (err, results) => {
    if (err) {
      console.error('Failed to fetch pending orders:', err);
      return res.status(500).json({ message: 'Database error fetching orders' });
    }
    res.status(200).json(results);
  });
});

// Delete a specific pending order (after autofill or manual delete)
// ✅ CLEANUP must come BEFORE :id delete route
app.delete('/api/pending-orders/cleanup', (req, res) => {
  const query = 'DELETE FROM pending_orders WHERE created_at < NOW() - INTERVAL 30 DAY';
  db.query(query, (err, result) => {
    if (err) {
      console.error('Failed to clean up old orders:', err);
      return res.status(500).json({ message: 'Database error during cleanup' });
    }
    res.status(200).json({ message: `Cleaned ${result.affectedRows} old orders` });
  });
});

// ⚠️ This must be BELOW the cleanup route
app.delete('/api/pending-orders/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM pending_orders WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Failed to delete pending order:', err);
      return res.status(500).json({ message: 'Database error deleting order' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json({ message: 'Order deleted successfully' });
  });
});



// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
