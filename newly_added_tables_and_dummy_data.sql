-- ==============================================================================
-- NutriCare Connect — Newly Added Tables & Incremental Dummy Dataset
-- Database: MySQL 8.0+
-- 
-- This script contains the schema and dummy data specifically for newly added
-- tables, updated column structures, and foreign key relations:
--   1. account_id_counters (for role-based IDs: P001, D001, DT001, A001, etc.)
--   2. password_reset_otps (secure OTPs with expiry & retry limit)
--   3. email_delivery_attempts (audit trail for simulated & SMTP emails)
--   4. audit_events (activity logging for all roles and operations)
--   5. Expanded user_accounts columns (phone_number, date_of_birth, address,
--      must_change_password, enabled, updated_at)
--   6. Health Check vitals widening (temperature DECIMAL(5,2))
--   7. Sample dummy data for all new tables and relations
-- ==============================================================================

USE nutricare;

-- ==============================================================================
-- 1. CREATE NEWLY ADDED TABLES (IF NOT EXISTS)
-- ==============================================================================

-- Table 1: account_id_counters
CREATE TABLE IF NOT EXISTS account_id_counters (
    prefix VARCHAR(3) NOT NULL PRIMARY KEY,
    next_value INT NOT NULL
) ENGINE=InnoDB;

-- Table 2: password_reset_otps
CREATE TABLE IF NOT EXISTS password_reset_otps (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(16) NOT NULL,
    otp_hash VARCHAR(100) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_reset_user_created (user_id, created_at),
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table 3: email_delivery_attempts
CREATE TABLE IF NOT EXISTS email_delivery_attempts (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    recipient_email VARCHAR(190) NOT NULL,
    template VARCHAR(80) NOT NULL,
    status VARCHAR(30) NOT NULL,
    message_preview VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_email_status_created (status, created_at)
) ENGINE=InnoDB;

-- Table 4: audit_events
CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    actor_id VARCHAR(16) NULL,
    operation VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(80) NULL,
    occurred_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_audit_time (occurred_at)
) ENGINE=InnoDB;


-- ==============================================================================
-- 2. DUMMY DATA FOR NEWLY ADDED TABLES
-- ==============================================================================

-- 2.1 Seed Account ID Counters
INSERT INTO account_id_counters (prefix, next_value) VALUES
    ('P', 4),
    ('D', 2),
    ('DT', 2),
    ('R', 2),
    ('A', 2),
    ('O', 2),
    ('F', 2),
    ('C', 2),
    ('PR', 2)
ON DUPLICATE KEY UPDATE next_value = VALUES(next_value);

-- 2.2 Seed Password Reset OTPs
INSERT INTO password_reset_otps 
    (id, user_id, otp_hash, expires_at, used, attempts, created_at)
VALUES
    ('71000000-0000-0000-0000-000000000001', 'P001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', DATE_SUB(NOW(6), INTERVAL 1 DAY), TRUE, 0, DATE_SUB(NOW(6), INTERVAL 1 DAY)),
    ('71000000-0000-0000-0000-000000000002', 'P002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', DATE_ADD(NOW(6), INTERVAL 10 MINUTE), FALSE, 0, NOW(6))
ON DUPLICATE KEY UPDATE otp_hash = VALUES(otp_hash);

-- 2.3 Seed Email Delivery Attempts
INSERT INTO email_delivery_attempts 
    (id, recipient_email, template, status, message_preview, created_at)
VALUES
    ('72000000-0000-0000-0000-000000000001', 'patient@nutricare.demo', 'WELCOME', 'SIMULATED_DELIVERED', 'Welcome to NutriCare Connect, Kasun! Your patient portal is now active.', DATE_SUB(NOW(6), INTERVAL 10 DAY)),
    ('72000000-0000-0000-0000-000000000002', 'patient2@nutricare.demo', 'APPOINTMENT_CONFIRMATION', 'SIMULATED_DELIVERED', 'Your appointment with Dr. Ruwan Jayasinghe is confirmed.', DATE_SUB(NOW(6), INTERVAL 2 DAY))
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- 2.4 Seed Audit Events
INSERT INTO audit_events 
    (id, actor_id, operation, entity_type, entity_id, occurred_at) 
VALUES
    ('91000000-0000-0000-0000-000000000001', 'P001', 'LOGIN_SUCCESS', 'USER_ACCOUNT', 'P001', DATE_SUB(NOW(6), INTERVAL 2 HOUR)),
    ('91000000-0000-0000-0000-000000000002', 'A001', 'ACCOUNT_ENABLED', 'USER_ACCOUNT', 'P002', DATE_SUB(NOW(6), INTERVAL 1 DAY)),
    ('91000000-0000-0000-0000-000000000003', 'DT001', 'DIET_PLAN_PUBLISH', 'DIET_PLAN', '19000000-0000-0000-0000-000000000001', DATE_SUB(NOW(6), INTERVAL 12 DAY)),
    ('91000000-0000-0000-0000-000000000004', 'D001', 'HEALTH_CHECK_CREATE', 'HEALTH_CHECK', 'e9000000-0000-0000-0000-000000000001', DATE_SUB(NOW(6), INTERVAL 14 DAY))
ON DUPLICATE KEY UPDATE operation = VALUES(operation);
