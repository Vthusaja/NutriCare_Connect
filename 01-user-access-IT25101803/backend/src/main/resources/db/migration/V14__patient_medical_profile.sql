CREATE TABLE patient_medical_profiles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_account_id VARCHAR(16) NOT NULL UNIQUE,
  blood_group VARCHAR(10),
  allergies TEXT,
  chronic_conditions TEXT,
  emergency_contact_name VARCHAR(100),
  emergency_contact_relation VARCHAR(50),
  emergency_contact_phone VARCHAR(20),
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_patient_profile_user FOREIGN KEY (user_account_id) REFERENCES user_accounts(id) ON DELETE CASCADE
);

CREATE TABLE patient_medical_documents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_profile_id BIGINT NOT NULL,
  document_title VARCHAR(150) NOT NULL,
  document_category VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  uploaded_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_document_profile FOREIGN KEY (patient_profile_id) REFERENCES patient_medical_profiles(id) ON DELETE CASCADE
);
