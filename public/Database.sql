USE ukulimahoney;

CREATE TABLE IF NOT EXISTS products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_type VARCHAR(50) NOT NULL,
    volume_ml INT NOT NULL,
    price_per_unit DECIMAL(10,2) NOT NULL,
    UNIQUE(product_type, volume_ml)
);


CREATE TABLE IF NOT EXISTS sales_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    sales_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (sales_id) REFERENCES sales(sales_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE IF NOT EXISTS inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    stock_quantity INT NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

