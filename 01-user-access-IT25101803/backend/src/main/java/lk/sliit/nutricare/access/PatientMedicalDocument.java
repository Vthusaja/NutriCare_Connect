package lk.sliit.nutricare.access;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "patient_medical_documents")
public class PatientMedicalDocument {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "patient_profile_id", nullable = false)
  private Long patientProfileId;

  @Column(name = "document_title", nullable = false, length = 150)
  private String documentTitle;

  @Column(name = "document_category", nullable = false, length = 50)
  private String documentCategory;

  @Column(name = "file_name", nullable = false, length = 255)
  private String fileName;

  @Column(name = "file_path", nullable = false, length = 500)
  private String filePath;

  @Column(name = "file_type", nullable = false, length = 100)
  private String fileType;

  @Column(name = "file_size_bytes", nullable = false)
  private Long fileSizeBytes;

  @Column(name = "uploaded_at", nullable = false, updatable = false)
  private Instant uploadedAt;

  protected PatientMedicalDocument() {}

  public PatientMedicalDocument(
      Long patientProfileId,
      String documentTitle,
      String documentCategory,
      String fileName,
      String filePath,
      String fileType,
      Long fileSizeBytes) {
    this.patientProfileId = patientProfileId;
    this.documentTitle = documentTitle;
    this.documentCategory = documentCategory;
    this.fileName = fileName;
    this.filePath = filePath;
    this.fileType = fileType;
    this.fileSizeBytes = fileSizeBytes;
    this.uploadedAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public Long getPatientProfileId() {
    return patientProfileId;
  }

  public String getDocumentTitle() {
    return documentTitle;
  }

  public String getDocumentCategory() {
    return documentCategory;
  }

  public String getFileName() {
    return fileName;
  }

  public String getFilePath() {
    return filePath;
  }

  public String getFileType() {
    return fileType;
  }

  public Long getFileSizeBytes() {
    return fileSizeBytes;
  }

  public Instant getUploadedAt() {
    return uploadedAt;
  }
}
