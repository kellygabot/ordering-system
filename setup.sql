CREATE DATABASE ordering_system_db; 
USE ordering_system_db; 

CREATE TABLE customers (
	customer_id INT AUTO_INCREMENT PRIMARY KEY,
	full_name VARCHAR(100) NOT NULL,
	email VARCHAR(100) NOT NULL UNIQUE,
	phone VARCHAR(20) NOT NULL UNIQUE,
	address TEXT NOT NULL,
	Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products ( 
product_id INT AUTO_INCREMENT PRIMARY KEY, 
product_name VARCHAR(100) NOT NULL, 
description TEXT,
price DECIMAL(10,2) NOT NULL, 
stock INT NOT NULL DEFAULT 0,
status VARCHAR(20) DEFAULT 'Available', 
CHECK (price > 0), 
CHECK (stock >= 0) 
); 

CREATE TABLE orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  order_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CHECK (total_amount >= 0)
);

CREATE TABLE order_items (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id)
    REFERENCES orders(order_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id)
    REFERENCES products(product_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CHECK (quantity > 0),
  CHECK (subtotal >= 0)
);

INSERT INTO customers (full_name, email, phone, address)
VALUES
  ('Juan Dela Cruz', 'juan@email.com', '09171234567', 'Manila'),
  ('Maria Santos', 'maria@email.com', '09181234567', 'Quezon City');

INSERT INTO products (product_name, description, price, stock)
VALUES
  ('Burger', 'Cheesy beef burger', 89.00, 50),
  ('Fries', 'Large crispy fries', 45.00, 100),
  ('Milk Tea', 'Wintermelon milk tea', 65.00, 80);

-- INSERT
INSERT INTO products (product_name, description, price, stock)
VALUES 
	('Pizza Slice', 'Ham and cheese pizza', 75.00, 40),
    ('Donut', 'Chocolate Filled', 45.00, 50);


UPDATE products
SET stock = 90 
WHERE product_name = 'Fries';
UPDATE orders 
SET order_status = 'Completed' 
WHERE order_id = 1;

-- DELETE
DELETE FROM order_items WHERE order_item_id = 1;
DELETE FROM products WHERE product_id = 4;

-- ALTER TABLE
ALTER TABLE customers ADD gender VARCHAR(20) NOT NULL DEFAULT 'Not Specified';
ALTER TABLE products ADD product_image VARCHAR(255) NULL;


-- Test NOT NULL
INSERT INTO customers (full_name, email, phone, address)
VALUES (NULL, 'test@email.com', '09999999999', 'Cebu');

-- Test UNIQUE
INSERT INTO customers (full_name, email, phone, address)
VALUES ('Pedro Reyes', 'juan@email.com', '09190000000', 'Pasig');

-- Test CHECK
INSERT INTO products (product_name, description, price, stock)
VALUES ('Invalid Product', 'Test', -20.00, 10);

-- Test FOREIGN KEY
INSERT INTO orders (customer_id, total_amount, order_status)
VALUES (99, 100.00, 'Pending');
