CREATE DATABASE wadi_bina_db;
GO
USE wadi_bina_db;
GO

-- جدول المستخدمين
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CONSTRAINT DF_users_role DEFAULT 'موظف'
    );
END;
GO

-- إدخال المستخدم الافتراضي
IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE username = 'admin')
BEGIN
    INSERT INTO dbo.users (username, password, role)
    VALUES ('admin', 'admin123', 'مدير');
END;
GO

-- جدول حجوزات التذاكر
IF OBJECT_ID(N'dbo.bus_bookings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.bus_bookings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        created_by VARCHAR(50),
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(30),
        passport VARCHAR(50),
        boarding_from VARCHAR(50),
        dropoff_to VARCHAR(50),
        travel_date DATE,
        passenger_count INT,
        reporting_time VARCHAR(50),
        price VARCHAR(50),
        price_value DECIMAL(10,2),
        payment_method VARCHAR(50),
        created_at DATETIME DEFAULT GET DATE()
    );
END;
GO

-- جدول فواتير الشحن
IF OBJECT_ID(N'dbo.cargo_invoices', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cargo_invoices (
        id INT IDENTITY(1,1) PRIMARY KEY,
        inv_no VARCHAR(50) NOT NULL,
        invoice_date DATE,
        pay_location VARCHAR(50),
        paid_status VARCHAR(30),
        sender_name VARCHAR(100),
        sender_phone VARCHAR(30),
        sender_address NVARCHAR(MAX),
        receiver_name VARCHAR(100),
        receiver_phone VARCHAR(30),
        receiver_address NVARCHAR(MAX),
        items_json NVARCHAR(MAX),
        grand_total DECIMAL(10,2),
        created_by VARCHAR(50)
    );
END;
GO

-- جدول الفواتير المالية العامة
IF OBJECT_ID(N'dbo.financial_invoices', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.financial_invoices (
        id INT IDENTITY(1,1) PRIMARY KEY,
        number VARCHAR(50) NOT NULL,
        invoice_date DATE,
        client_name VARCHAR(100),
        service_type VARCHAR(100),
        amount VARCHAR(50),
        amount_val DECIMAL(10,2),
        status VARCHAR(30),
        notes NVARCHAR(MAX)
    );
END;
GO

-- جدول المديونيات اليدوية
IF OBJECT_ID(N'dbo.manual_debts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.manual_debts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name VARCHAR(100),
        phone VARCHAR(30),
        claim_type VARCHAR(50),
        doc_no VARCHAR(50),
        amount VARCHAR(50),
        amount_val DECIMAL(10,2),
        pay_location VARCHAR(50)
    );
END;
GO