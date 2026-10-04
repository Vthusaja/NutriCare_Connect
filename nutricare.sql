-- ==============================================================================
-- NutriCare Connect — Complete Database Schema & Dummy Dataset
-- Database: MySQL 8.0+
-- Charset: utf8mb4 / utf8mb4_unicode_ci
-- Default Password for all demo accounts: password123
-- BCrypt Hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
-- ==============================================================================

DROP DATABASE IF EXISTS nutricare;
CREATE DATABASE nutricare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nutricare;

SET FOREIGN_KEY_CHECKS = 0;

-- ==============================================================================
-- 1. DROP EXISTING TABLES (Reverse Dependency Order)
-- ==============================================================================
DROP TABLE IF EXISTS complaints;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS secure_messages;
DROP TABLE IF EXISTS progress_logs;
DROP TABLE IF EXISTS diet_plans;
DROP TABLE IF EXISTS health_alerts;
DROP TABLE IF EXISTS health_checks;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS availability_slots;
DROP TABLE IF EXISTS email_delivery_attempts;
DROP TABLE IF EXISTS password_reset_otps;
DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS account_id_counters;
DROP TABLE IF EXISTS user_accounts;

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- 2. CREATE TABLES (Dependency Order)
-- ==============================================================================

-- 2.1 User Accounts
CREATE TABLE user_accounts (
    id VARCHAR(16) NOT NULL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    phone_number VARCHAR(30) NULL,
    date_of_birth DATE NULL,
    address VARCHAR(500) NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    failed_attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;

-- 2.2 Account ID Counters (For sequential role-based IDs e.g. P001, D001)
CREATE TABLE account_id_counters (
    prefix VARCHAR(3) NOT NULL PRIMARY KEY,
    next_value INT NOT NULL
) ENGINE=InnoDB;

-- 2.3 Password Reset OTPs
CREATE TABLE password_reset_otps (
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

-- 2.4 Email Delivery Attempts
CREATE TABLE email_delivery_attempts (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    recipient_email VARCHAR(190) NOT NULL,
    template VARCHAR(80) NOT NULL,
    status VARCHAR(30) NOT NULL,
    message_preview VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_email_status_created (status, created_at)
) ENGINE=InnoDB;

-- 2.5 Audit Events
CREATE TABLE audit_events (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    actor_id VARCHAR(16) NULL,
    operation VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(80) NULL,
    occurred_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_audit_time (occurred_at)
) ENGINE=InnoDB;

-- 2.6 Practitioner Availability Slots
CREATE TABLE availability_slots (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    practitioner_id VARCHAR(16) NOT NULL,
    start_time DATETIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    hold_expires_at TIMESTAMP(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_practitioner_slot UNIQUE (practitioner_id, start_time),
    CONSTRAINT fk_slot_practitioner FOREIGN KEY (practitioner_id) REFERENCES user_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2.7 Appointments
CREATE TABLE appointments (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    slot_id VARCHAR(36) NOT NULL,
    patient_id VARCHAR(16) NOT NULL,
    practitioner_id VARCHAR(16) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_appointment_patient (patient_id),
    CONSTRAINT fk_appointment_slot FOREIGN KEY (slot_id) REFERENCES availability_slots(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appointment_patient FOREIGN KEY (patient_id) REFERENCES user_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appointment_practitioner FOREIGN KEY (practitioner_id) REFERENCES user_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2.8 Invoices
CREATE TABLE invoices (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    appointment_id VARCHAR(36) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_invoice_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2.9 Payments
CREATE TABLE payments (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    invoice_id VARCHAR(36) NOT NULL,
    reference VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2.10 Health Checks
CREATE TABLE health_checks (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    patient_id VARCHAR(16) NOT NULL,
    practitioner_id VARCHAR(16) NOT NULL,
    weight_kg DECIMAL(5, 2) NULL,
    bmi DECIMAL(5, 2) NULL,
    systolic INT NULL,
    diastolic INT NULL,
    blood_sugar DECIMAL(5, 2) NULL,
    temperature DECIMAL(5, 2) NULL,
    notes VARCHAR(2000) NULL,
    recorded_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_health_patient (patient_id),
    CONSTRAINT fk_health_patient FOREIGN KEY (patient_id) REFERENCES user_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_health_practitioner FOREIGN KEY (practitioner_id) REFERENCES user_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2.11 Health Alerts
CREATE TABLE health_alerts (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    health_check_id VARCHAR(36) NOT NULL,
    patient_id VARCHAR(16) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    message VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_alert_patient (patient_id),
    CONSTRAINT fk_alert_check FOREIGN KEY (health_check_id) REFERENCES health_checks(id) ON DELETE RESTRICT,
    CONSTRAINT fk_alert_patient FOREIGN KEY (patient_id) REFERENCES user_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2.12 Diet Plans
CREATE TABLE diet_plans (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    patient_id VARCHAR(16) NOT NULL,
    dietitian_id VARCHAR(16) NOT NULL,
    title VARCHAR(255) NOT NULL,
    calorie_target INT NULL,
    exclusions VARCHAR(500) NULL,
    meal_schedule VARCHAR(3000) NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_diet_patient (patient_id),
    CONSTRAINT fk_diet_patient FOREIGN KEY (patient_id) REFERENCES user_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_diet_dietitian FOREIGN KEY (dietitian_id) REFERENCES user_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2.13 Progress Logs
CREATE TABLE progress_logs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    patient_id VARCHAR(16) NOT NULL,
    diet_plan_id VARCHAR(36) NULL,
    log_date DATE NOT NULL,
    weight_kg DECIMAL(5, 2) NULL,
    bmi DECIMAL(5, 2) NULL,
    water_glasses INT NULL,
    meals_completed INT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_progress_patient (patient_id),
    CONSTRAINT fk_progress_patient FOREIGN KEY (patient_id) REFERENCES user_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_progress_plan FOREIGN KEY (diet_plan_id) REFERENCES diet_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 2.14 Secure Messages
CREATE TABLE secure_messages (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    sender_id VARCHAR(16) NOT NULL,
    recipient_id VARCHAR(16) NOT NULL,
    patient_id VARCHAR(16) NOT NULL,
    body VARCHAR(2000) NOT NULL,
    sent_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_msg_sender (sender_id),
    INDEX idx_msg_recipient (recipient_id),
    CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES user_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_message_recipient FOREIGN KEY (recipient_id) REFERENCES user_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_message_patient FOREIGN KEY (patient_id) REFERENCES user_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2.15 Notifications
CREATE TABLE notifications (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    recipient_id VARCHAR(16) NOT NULL,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    message VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL,
    attempts INT NOT NULL DEFAULT 1,
    retry_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_notif_recipient (recipient_id),
    CONSTRAINT fk_notification_recipient FOREIGN KEY (recipient_id) REFERENCES user_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2.16 Feedback
CREATE TABLE feedback (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    patient_id VARCHAR(16) NOT NULL,
    practitioner_id VARCHAR(16) NOT NULL,
    appointment_id VARCHAR(36) NOT NULL,
    rating INT NOT NULL,
    comments VARCHAR(1500) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_feedback_patient (patient_id),
    CONSTRAINT fk_feedback_patient FOREIGN KEY (patient_id) REFERENCES user_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_feedback_practitioner FOREIGN KEY (practitioner_id) REFERENCES user_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_feedback_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 2.17 Complaints
CREATE TABLE complaints (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    feedback_id VARCHAR(36) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_complaint_feedback FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE RESTRICT
) ENGINE=InnoDB;


-- ==============================================================================
-- 3. DUMMY DEMO DATASET
-- All user accounts use password: password123
-- ==============================================================================

-- 3.1 User Accounts
INSERT INTO user_accounts 
    (id, full_name, email, phone_number, date_of_birth, address, password_hash, role, enabled, must_change_password, locked, failed_attempts, created_at, updated_at) 
VALUES
    ('P001', 'Kasun Perera', 'patient@nutricare.demo', '+94 77 000 0001', '1998-04-12', '12 Lake View Road, Colombo 03', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'PATIENT', TRUE, FALSE, FALSE, 0, DATE_SUB(NOW(6), INTERVAL 120 DAY), NOW(6)),
    ('P002', 'Nadeesha Silva', 'patient2@nutricare.demo', '+94 77 000 0010', '1994-11-08', '45 Temple Road, Kandy', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'PATIENT', TRUE, FALSE, FALSE, 0, DATE_SUB(NOW(6), INTERVAL 90 DAY), NOW(6)),
    ('P003', 'Chamara Wickramasinghe', 'patient3@nutricare.demo', '+94 71 234 5678', '1989-07-22', '88 Galle Road, Mount Lavinia', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'PATIENT', TRUE, FALSE, FALSE, 0, DATE_SUB(NOW(6), INTERVAL 45 DAY), NOW(6)),
    ('DT001', 'Dilani Fernando', 'dietitian@nutricare.demo', '+94 77 000 0002', '1987-02-14', 'NutriCare Main Centre, Colombo 07', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'DIETITIAN', TRUE, FALSE, FALSE, 0, DATE_SUB(NOW(6), INTERVAL 180 DAY), NOW(6)),
    ('D001', 'Dr. Ruwan Jayasinghe', 'doctor@nutricare.demo', '+94 77 000 0003', '1980-09-30', 'NutriCare Main Centre, Colombo 07', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'DOCTOR', TRUE, FALSE, FALSE, 0, DATE_SUB(NOW(6), INTERVAL 180 DAY), NOW(6)),
    ('R001', 'Samanthi Weerasinghe', 'reception@nutricare.demo', '+94 77 000 0004', '1995-05-18', 'NutriCare Main Reception Desk', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'RECEPTION_STAFF', TRUE, FALSE, FALSE, 0, DATE_SUB(NOW(6), INTERVAL 150 DAY), NOW(6)),
    ('A001', 'System Administrator', 'admin@nutricare.demo', '+94 11 200 0000', '1985-01-01', 'NutriCare HQ IT Department', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'SYSTEM_ADMIN', TRUE, FALSE, FALSE, 0, DATE_SUB(NOW(6), INTERVAL 200 DAY), NOW(6)),
    ('O001', 'Operations Manager', 'ops@nutricare.demo', '+94 11 200 0001', '1982-12-05', 'NutriCare Operations Suite', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'OPERATIONS_MANAGER', TRUE, FALSE, FALSE, 0, DATE_SUB(NOW(6), INTERVAL 160 DAY), NOW(6)),
    ('F001', 'Finance Executive', 'finance@nutricare.demo', '+94 11 200 0002', '1990-03-25', 'NutriCare Finance & Billing Dept', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'FINANCE_EXECUTIVE', TRUE, FALSE, FALSE, 0, DATE_SUB(NOW(6), INTERVAL 160 DAY), NOW(6)),
    ('C001', 'Medical Center Coordinator', 'coordinator@nutricare.demo', '+94 11 200 0003', '1988-06-15', 'NutriCare Coordination Office', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'MEDICAL_CENTER_COORDINATOR', TRUE, FALSE, FALSE, 0, DATE_SUB(NOW(6), INTERVAL 140 DAY), NOW(6)),
    ('PR001', 'Patient Relations Officer', 'relations@nutricare.demo', '+94 11 200 0004', '1992-08-19', 'NutriCare Patient Care Unit', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'PATIENT_RELATIONS_OFFICER', TRUE, FALSE, FALSE, 0, DATE_SUB(NOW(6), INTERVAL 140 DAY), NOW(6));

-- 3.2 Account ID Counters
INSERT INTO account_id_counters (prefix, next_value) VALUES
    ('P', 4),
    ('D', 2),
    ('DT', 2),
    ('R', 2),
    ('A', 2),
    ('O', 2),
    ('F', 2),
    ('C', 2),
    ('PR', 2);

-- 3.3 Password Reset OTPs
INSERT INTO password_reset_otps 
    (id, user_id, otp_hash, expires_at, used, attempts, created_at)
VALUES
    ('71000000-0000-0000-0000-000000000001', 'P001', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', DATE_SUB(NOW(6), INTERVAL 1 DAY), TRUE, 0, DATE_SUB(NOW(6), INTERVAL 1 DAY)),
    ('71000000-0000-0000-0000-000000000002', 'P002', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', DATE_ADD(NOW(6), INTERVAL 10 MINUTE), FALSE, 0, NOW(6));

-- 3.4 Email Delivery Attempts
INSERT INTO email_delivery_attempts 
    (id, recipient_email, template, status, message_preview, created_at)
VALUES
    ('72000000-0000-0000-0000-000000000001', 'patient@nutricare.demo', 'WELCOME', 'SIMULATED_DELIVERED', 'Welcome to NutriCare Connect, Kasun! Your patient portal is now active.', DATE_SUB(NOW(6), INTERVAL 10 DAY)),
    ('72000000-0000-0000-0000-000000000002', 'patient2@nutricare.demo', 'APPOINTMENT_CONFIRMATION', 'SIMULATED_DELIVERED', 'Your appointment with Dr. Ruwan Jayasinghe is confirmed.', DATE_SUB(NOW(6), INTERVAL 2 DAY));

-- 3.5 Audit Events
INSERT INTO audit_events 
    (id, actor_id, operation, entity_type, entity_id, occurred_at) 
VALUES
    ('91000000-0000-0000-0000-000000000001', 'P001', 'LOGIN_SUCCESS', 'USER_ACCOUNT', 'P001', DATE_SUB(NOW(6), INTERVAL 2 HOUR)),
    ('91000000-0000-0000-0000-000000000002', 'A001', 'ACCOUNT_ENABLED', 'USER_ACCOUNT', 'P002', DATE_SUB(NOW(6), INTERVAL 1 DAY)),
    ('91000000-0000-0000-0000-000000000003', 'DT001', 'DIET_PLAN_PUBLISH', 'DIET_PLAN', '19000000-0000-0000-0000-000000000001', DATE_SUB(NOW(6), INTERVAL 12 DAY)),
    ('91000000-0000-0000-0000-000000000004', 'D001', 'HEALTH_CHECK_CREATE', 'HEALTH_CHECK', 'e9000000-0000-0000-0000-000000000001', DATE_SUB(NOW(6), INTERVAL 14 DAY));

-- 3.6 Availability Slots
INSERT INTO availability_slots 
    (id, practitioner_id, start_time, duration_minutes, status, hold_expires_at, version) 
VALUES
    ('a9000000-0000-0000-0000-000000000001', 'D001', DATE_SUB(NOW(6), INTERVAL 14 DAY), 60, 'BOOKED', NULL, 1),
    ('a9000000-0000-0000-0000-000000000002', 'DT001', DATE_ADD(NOW(6), INTERVAL 3 DAY), 45, 'AVAILABLE', NULL, 0),
    ('a9000000-0000-0000-0000-000000000003', 'D001', DATE_ADD(NOW(6), INTERVAL 4 DAY), 60, 'AVAILABLE', NULL, 0),
    ('a9000000-0000-0000-0000-000000000004', 'DT001', DATE_SUB(NOW(6), INTERVAL 10 DAY), 45, 'BOOKED', NULL, 1),
    ('a9000000-0000-0000-0000-000000000005', 'D001', DATE_ADD(NOW(6), INTERVAL 7 DAY), 60, 'AVAILABLE', NULL, 0);

-- 3.7 Appointments
INSERT INTO appointments 
    (id, slot_id, patient_id, practitioner_id, service_type, status, created_at) 
VALUES
    ('b9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001', 'P001', 'D001', 'HEALTH_CHECK', 'COMPLETED', DATE_SUB(NOW(6), INTERVAL 16 DAY)),
    ('b9000000-0000-0000-0000-000000000002', 'a9000000-0000-0000-0000-000000000004', 'P001', 'DT001', 'DIET_CONSULTATION', 'CONFIRMED', DATE_SUB(NOW(6), INTERVAL 10 DAY));

-- 3.8 Invoices
INSERT INTO invoices 
    (id, invoice_number, appointment_id, amount, status, created_at) 
VALUES
    ('c9000000-0000-0000-0000-000000000001', 'NC-DEMO-0001', 'b9000000-0000-0000-0000-000000000001', 4500.00, 'PAID', DATE_SUB(NOW(6), INTERVAL 16 DAY)),
    ('c9000000-0000-0000-0000-000000000002', 'NC-DEMO-0002', 'b9000000-0000-0000-0000-000000000002', 3000.00, 'PENDING', DATE_SUB(NOW(6), INTERVAL 10 DAY));

-- 3.9 Payments
INSERT INTO payments 
    (id, invoice_id, reference, amount, method, status, created_at) 
VALUES
    ('d9000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001', 'DEMO-PAY-0001', 4500.00, 'DEMO_CARD', 'SUCCESS', DATE_SUB(NOW(6), INTERVAL 16 DAY));

-- 3.10 Health Checks
INSERT INTO health_checks 
    (id, patient_id, practitioner_id, weight_kg, bmi, systolic, diastolic, blood_sugar, temperature, notes, recorded_at)
VALUES
    ('e9000000-0000-0000-0000-000000000001', 'P001', 'D001', 78.40, 26.10, 146, 92, 151.00, 36.70, 'Baseline assessment: Elevated blood sugar and mild stage 1 hypertension detected.', DATE_SUB(NOW(6), INTERVAL 14 DAY)),
    ('e9000000-0000-0000-0000-000000000002', 'P001', 'D001', 76.90, 25.60, 132, 84, 126.00, 36.60, 'Follow-up checkup: Vitals improving following dietary adjustments.', DATE_SUB(NOW(6), INTERVAL 2 DAY)),
    ('e9000000-0000-0000-0000-000000000003', 'P002', 'D001', 62.50, 22.40, 118, 76, 98.00, 36.80, 'Routine wellness checkup. Patient is in optimal health.', DATE_SUB(NOW(6), INTERVAL 5 DAY));

-- 3.11 Health Alerts
INSERT INTO health_alerts 
    (id, health_check_id, patient_id, priority, message, status, created_at) 
VALUES
    ('f9000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001', 'P001', 'HIGH', 'Blood sugar level (151 mg/dL) exceeds standard fasting threshold; clinical review recommended.', 'OPEN', DATE_SUB(NOW(6), INTERVAL 14 DAY)),
    ('f9000000-0000-0000-0000-000000000002', 'e9000000-0000-0000-0000-000000000001', 'P001', 'MEDIUM', 'Systolic blood pressure (146 mmHg) flagged for routine monitoring.', 'OPEN', DATE_SUB(NOW(6), INTERVAL 14 DAY));

-- 3.12 Diet Plans
INSERT INTO diet_plans 
    (id, patient_id, dietitian_id, title, calorie_target, exclusions, meal_schedule, status, created_at)
VALUES
    ('19000000-0000-0000-0000-000000000001', 'P001', 'DT001', 'Balanced Sri Lankan Starter Plan', 1900, 'No refined sugar, avoid deep-fried food and shellfish', 'Breakfast: Oatmeal with fresh papaya; Lunch: Red rice with gotukola sambol and fish curry; Dinner: Vegetable soup with wholemeal roti; Snacks: Green tea and curd', 'PUBLISHED', DATE_SUB(NOW(6), INTERVAL 12 DAY)),
    ('19000000-0000-0000-0000-000000000002', 'P002', 'DT001', 'High Protein & Lean Nutrition Plan', 2100, 'Lactose intolerance (dairy-free)', 'Breakfast: Boiled eggs with kurakkan pittu; Lunch: Brown rice with grilled chicken and dhal; Dinner: Steamed vegetables with tuna; Snacks: Roasted almonds', 'PUBLISHED', DATE_SUB(NOW(6), INTERVAL 8 DAY));

-- 3.13 Progress Logs
INSERT INTO progress_logs 
    (id, patient_id, diet_plan_id, log_date, weight_kg, bmi, water_glasses, meals_completed, created_at)
VALUES
    ('29000000-0000-0000-0000-000000000001', 'P001', '19000000-0000-0000-0000-000000000001', DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY), 78.10, 26.00, 6, 3, DATE_SUB(NOW(6), INTERVAL 6 DAY)),
    ('29000000-0000-0000-0000-000000000002', 'P001', '19000000-0000-0000-0000-000000000001', DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY), 77.40, 25.80, 8, 4, DATE_SUB(NOW(6), INTERVAL 3 DAY)),
    ('29000000-0000-0000-0000-000000000003', 'P001', '19000000-0000-0000-0000-000000000001', CURRENT_DATE, 76.90, 25.60, 7, 4, NOW(6));

-- 3.14 Secure Messages
INSERT INTO secure_messages 
    (id, sender_id, recipient_id, patient_id, body, sent_at) 
VALUES
    ('39000000-0000-0000-0000-000000000001', 'P001', 'DT001', 'P001', 'Hello Ms. Dilani, could you please review my meal log for this week?', DATE_SUB(NOW(6), INTERVAL 5 HOUR)),
    ('39000000-0000-0000-0000-000000000002', 'DT001', 'P001', 'P001', 'Hello Kasun, your blood sugar and weight logs look very promising. Keep it up!', DATE_SUB(NOW(6), INTERVAL 4 HOUR)),
    ('39000000-0000-0000-0000-000000000003', 'P001', 'D001', 'P001', 'Dr. Ruwan, I will bring my updated blood pressure log to our next checkup.', DATE_SUB(NOW(6), INTERVAL 2 MINUTE));

-- 3.15 Notifications
INSERT INTO notifications 
    (id, recipient_id, type, channel, message, status, attempts, retry_at, created_at) 
VALUES
    ('49000000-0000-0000-0000-000000000001', 'P001', 'APPOINTMENT_REMINDER', 'SMS', 'Reminder: Your diet consultation with Ms. Dilani Fernando is scheduled for this week.', 'DELIVERED_SIMULATED', 1, NULL, DATE_SUB(NOW(6), INTERVAL 1 DAY)),
    ('49000000-0000-0000-0000-000000000002', 'P001', 'HEALTH_ALERT', 'IN_APP', 'Alert: High blood sugar detected in your recent checkup.', 'DELIVERED_SIMULATED', 1, NULL, DATE_SUB(NOW(6), INTERVAL 14 DAY));

-- 3.16 Feedback
INSERT INTO feedback 
    (id, patient_id, practitioner_id, appointment_id, rating, comments, created_at) 
VALUES
    ('59000000-0000-0000-0000-000000000001', 'P001', 'D001', 'b9000000-0000-0000-0000-000000000001', 5, 'Excellent consultation. Dr. Ruwan provided clear explanations and proactive advice.', DATE_SUB(NOW(6), INTERVAL 15 DAY));

-- 3.17 Complaints
INSERT INTO complaints 
    (id, feedback_id, priority, status, created_at) 
VALUES
    ('69000000-0000-0000-0000-000000000001', '59000000-0000-0000-0000-000000000001', 'ROUTINE', 'RESOLVED', DATE_SUB(NOW(6), INTERVAL 15 DAY));

-- ==============================================================================
-- End of NutriCare Database Initialization Script
-- ==============================================================================
