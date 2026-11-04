CREATE DATABASE IF NOT EXISTS wadi_bina_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wadi_bina_db;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL
);

CREATE TABLE passengers (
    id VARCHAR(50) PRIMARY KEY,
    agent VARCHAR(100) NOT NULL,
    passenger_count INT NOT NULL,
    main_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    passport VARCHAR(50) NOT NULL,
    origin VARCHAR(50) NOT NULL,
    destination VARCHAR(50) NOT NULL,
    trip_date DATE NOT NULL,
    reporting_time VARCHAR(100) NOT NULL,
    fare DECIMAL(10, 2) NOT NULL,
    pay_method VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cargo_invoices (
    id VARCHAR(50) PRIMARY KEY,
    invoice_date DATE NOT NULL,
    trip_date DATE NOT NULL,
    sender_name VARCHAR(150) NOT NULL,
    sender_origin VARCHAR(50) NOT NULL,
    sender_phone VARCHAR(20) NOT NULL,
    receiver_name VARCHAR(150) NOT NULL,
    destination VARCHAR(50) NOT NULL,
    receiver_phone VARCHAR(20) NOT NULL,
    payment_status VARCHAR(50) NOT NULL,
    grand_total DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);