-- ==========================================================
-- نظام شركة وادي بناء للنقل البري VIP الشامل
-- Database Schema (MySQL / MariaDB)
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

INSERT INTO users (username, password, role) VALUES 
('وليد السيد', '708090', 'مدير'),
('محمود', '102030', 'موظف'),
('يوسف', '405060', 'موظف'),
('محمد', '104070', 'موظف')
ON DUPLICATE KEY UPDATE id=id;

-- 2. جدول حجز تذاكر الركاب (بدون أرقام مقاعد)
CREATE TABLE IF NOT EXISTS bus_bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_code INT NOT NULL UNIQUE,
    created_by VARCHAR(50) NOT NULL,
    passenger_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    passport_no VARCHAR(50) NOT NULL,
    boarding_from VARCHAR(50) NOT NULL,
    dropoff_to VARCHAR(50) NOT NULL,
    trip_date DATE NOT NULL,
    reporting_time VARCHAR(50) DEFAULT '07:00 صباحاً',
    price_value DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    audit_logs LONGTEXT NULL COMMENT 'سجل التعديلات بصيغة JSON',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. جدول فواتير الشحن والأمتعة (مع تاريخ الرحلة والتحريك)
CREATE TABLE IF NOT EXISTS cargo_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no INT NOT NULL UNIQUE,
    created_by VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL,
    trip_date DATE NOT NULL COMMENT 'تاريخ الرحلة / التحريك',
    pay_location VARCHAR(100) NOT NULL,
    paid_status VARCHAR(50) NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    sender_phone VARCHAR(30) NOT NULL,
    sender_address TEXT NULL,
    receiver_name VARCHAR(100) NOT NULL,
    receiver_phone VARCHAR(30) NOT NULL,
    receiver_address TEXT NULL,
    items_json LONGTEXT NOT NULL COMMENT 'تفاصيل الأصناف والكميات',
    grand_total DECIMAL(10,2) NOT NULL,
    audit_logs LONGTEXT NULL COMMENT 'سجل التعديلات بصيغة JSON',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. جدول الأمانات والسامان
CREATE TABLE IF NOT EXISTS trusts_and_amanat (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reference_no VARCHAR(50) NOT NULL,
    branch_location VARCHAR(50) NOT NULL,
    receiver_info VARCHAR(100) NOT NULL,
    content_description TEXT NOT NULL,
    amount DECIMAL(10,2) DEFAULT 0.00,
    payment_location VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 5. جدول المديونيات والمطالبات اليدوية
CREATE TABLE IF NOT EXISTS manual_debts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    debtor_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    claim_type VARCHAR(100) DEFAULT 'مديونية يدوية',
    doc_no VARCHAR(50) NOT NULL,
    amount_value DECIMAL(10,2) NOT NULL,
    pay_location VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;