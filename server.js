const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const db = require("./db");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));
const PORT = process.env.PORT || 3000;

// --- Products ---
app.get("/products", (req, res) => {
  db.query("SELECT * FROM products WHERE stock > 0", (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
});

// --- Place Order ---
app.post("/order", (req, res) => {
  const { full_name, email, phone, address, items } = req.body;

  if (!full_name || !email || !phone || !address || !items || !items.length) {
    return res.status(400).json({ message: "Missing required fields." });
  }
  if (/\d/.test(full_name)) {
    return res
      .status(400)
      .json({ message: "Full Name must not contain numbers." });
  }

  db.query(
    "SELECT customer_id FROM customers WHERE email = ?",
    [email],
    (err, existing) => {
      if (err) return res.status(500).json({ message: err.message });

      if (existing.length > 0) {
        const customerId = existing[0].customer_id;
        db.query(
          "UPDATE customers SET full_name = ?, phone = ?, address = ? WHERE customer_id = ?",
          [full_name, phone, address, customerId],
          (err) => {
            if (err) return res.status(500).json({ message: err.message });
            placeOrder(customerId, items, res);
          },
        );
      } else {
        db.query(
          "INSERT INTO customers (full_name, email, phone, address) VALUES (?, ?, ?, ?)",
          [full_name, email, phone, address],
          (err, result) => {
            if (err) return res.status(500).json({ message: err.message });
            placeOrder(result.insertId, items, res);
          },
        );
      }
    },
  );
});

function placeOrder(customerId, items, res) {
  let totalAmount = 0;
  items.forEach((item) => {
    totalAmount += item.quantity * item.price;
  });

  db.query(
    `INSERT INTO orders (customer_id, total_amount, order_status) VALUES (?, ?, 'Pending')`,
    [customerId, totalAmount],
    (err, orderResult) => {
      if (err) return res.status(500).json({ message: err.message });

      const orderId = orderResult.insertId;
      // Each item fires 2 queries; track all completions before responding.
      let pending = items.length * 2;
      let responded = false;

      function done(err) {
        if (responded) return;
        if (err) {
          responded = true;
          return res.status(500).json({ message: err.message });
        }
        pending--;
        if (pending === 0) {
          responded = true;
          res.json({
            message: "Order saved successfully",
            order_id: orderId,
            total_amount: totalAmount,
          });
        }
      }

      items.forEach((item) => {
        const subtotal = item.quantity * item.price;

        db.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?)`,
          [orderId, item.product_id, item.quantity, item.price, subtotal],
          (err) => done(err),
        );

        // Atomic decrement: only succeeds if sufficient stock exists (prevents overselling).
        db.query(
          `UPDATE products SET stock = stock - ? WHERE product_id = ? AND stock >= ?`,
          [item.quantity, item.product_id, item.quantity],
          (err, result) => {
            if (!err && result.affectedRows === 0) {
              err = new Error(
                `Insufficient stock for product ID ${item.product_id}.`,
              );
            }
            done(err);
          },
        );
      });
    },
  );
}

// --- Stats: Overview ---
app.get("/stats/overview", (req, res) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM orders)                        AS total_orders,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders)  AS total_revenue,
      (SELECT COUNT(*) FROM customers)                     AS total_customers
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result[0]);
  });
});

// --- Stats: Best Sellers ---
app.get("/stats/bestsellers", (req, res) => {
  const sql = `
    SELECT
      p.product_id, p.product_name, p.price,
      SUM(oi.quantity)            AS total_sold,
      SUM(oi.subtotal)            AS total_revenue,
      COUNT(DISTINCT oi.order_id) AS order_count
    FROM order_items oi
    JOIN products p ON p.product_id = oi.product_id
    GROUP BY p.product_id, p.product_name, p.price
    ORDER BY total_sold DESC
    LIMIT 10
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
});

// --- Stats: Pairings ---
app.get("/stats/pairings", (req, res) => {
  const sql = `
    SELECT
      p1.product_name AS product_a,
      p2.product_name AS product_b,
      COUNT(*)        AS pair_count
    FROM order_items a
    JOIN order_items b  ON a.order_id = b.order_id AND a.product_id < b.product_id
    JOIN products p1    ON p1.product_id = a.product_id
    JOIN products p2    ON p2.product_id = b.product_id
    GROUP BY a.product_id, b.product_id, p1.product_name, p2.product_name
    ORDER BY pair_count DESC
    LIMIT 10
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
