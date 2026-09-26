# Changes by Thusaja

The following changes were implemented to expand Module 01 (`01-user-access-IT25101803`) with the **Patient Medical Profile Management & Document Vault** feature set.

## 1. Database Migrations
- **Created `V14__patient_medical_profile.sql`**: Added `patient_medical_profiles` and `patient_medical_documents` tables. Configured foreign key relationships back to the core `user_accounts` table using the `VARCHAR(16)` schema.

## 2. Entities & Repositories
- **Entities**: Created `PatientMedicalProfile.java` and `PatientMedicalDocument.java`.
- **Repositories**: Created `PatientMedicalProfileRepository` and `PatientMedicalDocumentRepository` to handle data persistence.

## 3. Data Transfer Objects (DTOs)
- Created request and response records for the new endpoints:
  - `PatientProfileRequest.java`
  - `PatientProfileResponse.java`
  - `MedicalDocumentResponse.java`
  - `AuditEventResponse.java`

## 4. Services
- **`PatientProfileService.java`**: Handles fetching, automatic initialization, and updating of a patient's baseline medical profile (e.g., allergies, blood group).
- **`DocumentStorageService.java`**: Manages secure file uploads (`MultipartFile`), saving documents to a local `uploads/medical-documents/` directory with strict size (5MB) and type (PDF, JPEG, PNG) validations.
- **`AuditService.java`**: Exposes paginated `AuditEvent`s for administrative review.

## 5. Controllers
- **`PatientProfileController.java`**: Provided endpoints for patients (`/api/v1/patient/profile/me`) and clinicians (`/api/v1/clinical/patients/{userId}/profile`).
- **`MedicalDocumentController.java`**: Implemented upload, listing, and download endpoints for medical documents.
- **`AdminAuditController.java`**: Exposed system-wide audit logs to administrators at `/api/v1/admin/audit-logs`.
