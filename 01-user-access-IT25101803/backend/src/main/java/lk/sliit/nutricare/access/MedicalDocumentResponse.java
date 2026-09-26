package lk.sliit.nutricare.access;

import java.time.Instant;

public record MedicalDocumentResponse(
    Long id,
    String documentTitle,
    String documentCategory,
    String fileName,
    String fileType,
    Long fileSizeBytes,
    Instant uploadedAt) {
  public static MedicalDocumentResponse of(PatientMedicalDocument doc) {
    return new MedicalDocumentResponse(
        doc.getId(),
        doc.getDocumentTitle(),
        doc.getDocumentCategory(),
        doc.getFileName(),
        doc.getFileType(),
        doc.getFileSizeBytes(),
        doc.getUploadedAt());
  }
}
