const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const db = require("./db");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));
const PORT = process.env.PORT || 3000;

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function beginTransactionAsync() {
  return new Promise((resolve, reject) => {
    db.beginTransaction((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function commitAsync() {
  return new Promise((resolve, reject) => {
    db.commit((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function rollbackAsync() {
  return new Promise((resolve) => {
    db.rollback(() => resolve());
  });
}

// --- Products ---
app.get("/products", (req, res) => {
  db.query(
    "SELECT * FROM products ORDER BY product_name ASC",
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(result);
    },
  );
});

app.put("/products/:productId/stock", (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  const parsedStock = Number(req.body.stock);
  const newStock = Number.isInteger(parsedStock) ? parsedStock : NaN;

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Invalid product ID." });
  }
  if (!Number.isInteger(newStock) || newStock < 0) {
    return res
      .status(400)
      .json({ message: "Stock must be a non-negative whole number." });
  }

  db.query(
    "UPDATE products SET stock = ? WHERE product_id = ?",
    [newStock, productId],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Product not found." });
      }

      db.query(
        "SELECT product_id, product_name, stock FROM products WHERE product_id = ?",
        [productId],
        (err, rows) => {
          if (err) return res.status(500).json({ message: err.message });
          res.json({
            message: "Stock updated successfully.",
            product: rows[0],
          });
        },
      );
    },
  );
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
  if (!/^\d+$/.test(phone)) {
    return res
      .status(400)
      .json({ message: "Phone must contain numbers only." });
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
    `INSERT INTO orders (customer_id, total_amount) VALUES (?, ?, 'Pending')`,
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

app.get("/stats/orders", async (req, res) => {
  const sql = `
    SELECT
      o.order_id,
      o.order_date,
      o.total_amount,
      c.full_name,
      c.phone,
      oi.product_id,
      oi.quantity,
      p.product_name
    FROM orders o
    JOIN customers c ON c.customer_id = o.customer_id
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN products p ON p.product_id = oi.product_id
    ORDER BY o.order_date DESC, o.order_id DESC, oi.product_id ASC
  `;

  try {
    const rows = await queryAsync(sql);
    const orderMap = new Map();

    rows.forEach((row) => {
      if (!orderMap.has(row.order_id)) {
        orderMap.set(row.order_id, {
          order_id: row.order_id,
          order_date: row.order_date,
          total_amount: row.total_amount,
          full_name: row.full_name,
          phone: row.phone,
          items: [],
        });
      }

      if (row.product_id) {
        orderMap.get(row.order_id).items.push({
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: row.quantity,
        });
      }
    });

    res.json(Array.from(orderMap.values()));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/stats/orders/:orderId", async (req, res) => {
  const orderId = parseInt(req.params.orderId, 10);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ message: "Invalid order ID." });
  }

  try {
    await beginTransactionAsync();

    const existingOrder = await queryAsync(
      "SELECT order_id FROM orders WHERE order_id = ? FOR UPDATE",
      [orderId],
    );

    if (!existingOrder.length) {
      await rollbackAsync();
      return res.status(404).json({ message: "Order not found." });
    }

    const items = await queryAsync(
      "SELECT product_id, quantity FROM order_items WHERE order_id = ? FOR UPDATE",
      [orderId],
    );

    for (const item of items) {
      await queryAsync(
        "UPDATE products SET stock = stock + ? WHERE product_id = ?",
        [item.quantity, item.product_id],
      );
    }

    await queryAsync("DELETE FROM orders WHERE order_id = ?", [orderId]);
    await commitAsync();

    res.json({
      message: "Order deleted and stock restored successfully.",
      order_id: orderId,
      restored_items: items.length,
    });
  } catch (err) {
    await rollbackAsync();
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
