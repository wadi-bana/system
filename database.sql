-- ==========================================================
-- نظام إدارة شركة وادي بناء للنقل البري والشحن VIP
-- قاعدة البيانات: wadi_bina_db
-- ==========================================================

CREATE DATABASE IF NOT EXISTS wadi_bina_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wadi_bina_db;

-- 1. جدول المستخدمين والصلاحيات
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('مدير', 'موظف') NOT NULL DEFAULT 'موظف',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- إدخال الحساب الافتراضي للمدير
INSERT INTO users (username, password, role) VALUES 
('admin', 'admin123', 'مدير')
ON DUPLICATE KEY UPDATE id=id;

-- 2. جدول حجز تذاكر الركاب
CREATE TABLE IF NOT EXISTS bus_bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_code INT NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    passenger_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    passport_no VARCHAR(50) NOT NULL,
    boarding_from VARCHAR(50) NOT NULL,
    dropoff_to VARCHAR(50) NOT NULL,
    travel_date DATE NOT NULL,
    passenger_count INT NOT NULL DEFAULT 1,
    reporting_time VARCHAR(50) DEFAULT '07:00 صباحاً',
    price_value DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    passport_image LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. جدول فواتير الشحن والأمتعة
CREATE TABLE IF NOT EXISTS cargo_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no INT NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL,
    pay_location VARCHAR(100) NOT NULL,
    paid_status VARCHAR(50) NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    sender_phone VARCHAR(20) NOT NULL,
    sender_address TEXT NOT NULL,
    receiver_name VARCHAR(100) NOT NULL,
    receiver_phone VARCHAR(20) NOT NULL,
    receiver_address TEXT NOT NULL,
    grand_total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. جدول أصناف الشحنة (تفاصيل الفاتورة الواحدة)
CREATE TABLE IF NOT EXISTS cargo_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no INT NOT NULL,
    item_desc VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (invoice_no) REFERENCES cargo_invoices(invoice_no) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. جدول الفواتير المالية العامة
CREATE TABLE IF NOT EXISTS general_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number INT NOT NULL,
    invoice_date DATE NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    amount_value DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(50) NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. جدول المديونيات والمطالبات اليدوية
CREATE TABLE IF NOT EXISTS manual_debts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    debtor_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    claim_type VARCHAR(100) NOT NULL DEFAULT 'مديونية يدوية',
    doc_no INT NOT NULL,
    amount_value DECIMAL(10,2) NOT NULL,
    pay_location VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;