package lk.sliit.nutricare.access;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional
public class DocumentStorageService {
  private final Path rootLocation = Paths.get("uploads", "medical-documents");
  private final PatientMedicalDocumentRepository docs;
  private final PatientProfileService profiles;

  public DocumentStorageService(
      PatientMedicalDocumentRepository docs, PatientProfileService profiles) {
    this.docs = docs;
    this.profiles = profiles;
    try {
      Files.createDirectories(rootLocation);
    } catch (IOException e) {
      throw new RuntimeException("Could not initialize storage directory", e);
    }
  }

  public MedicalDocumentResponse uploadDocument(
      String userId, String title, String category, MultipartFile file) {
    long size = file.getSize();
    if (size > 5 * 1024 * 1024) {
      throw new IllegalArgumentException("File exceeds maximum size of 5MB");
    }

    String contentType = file.getContentType();
    if (contentType == null
        || (!contentType.equals("application/pdf")
            && !contentType.equals("image/jpeg")
            && !contentType.equals("image/png"))) {
      throw new IllegalArgumentException("Only PDF, JPEG, or PNG files are allowed");
    }

    PatientMedicalProfile profile = profiles.getOrCreateProfile(userId);

    try {
      String originalFilename = file.getOriginalFilename();
      if (originalFilename == null) originalFilename = "unknown";
      
      String ext = "";
      int lastDot = originalFilename.lastIndexOf(".");
      if (lastDot > 0) ext = originalFilename.substring(lastDot);

      String storedFilename = UUID.randomUUID().toString() + ext;
      Path destinationFile = rootLocation.resolve(storedFilename).normalize().toAbsolutePath();

      Files.copy(file.getInputStream(), destinationFile, StandardCopyOption.REPLACE_EXISTING);

      PatientMedicalDocument doc =
          new PatientMedicalDocument(
              profile.getId(),
              title,
              category,
              originalFilename,
              storedFilename,
              contentType,
              size);
      
      return MedicalDocumentResponse.of(docs.save(doc));
    } catch (IOException e) {
      throw new RuntimeException("Failed to store file", e);
    }
  }

  public List<MedicalDocumentResponse> listDocuments(String userId) {
    PatientMedicalProfile profile = profiles.getOrCreateProfile(userId);
    return docs.findByPatientProfileId(profile.getId()).stream()
        .map(MedicalDocumentResponse::of)
        .toList();
  }

  public Resource loadDocumentAsResource(String userId, Long documentId) {
    PatientMedicalDocument doc =
        docs.findById(documentId).orElseThrow(() -> new IllegalArgumentException("Document not found"));
    PatientMedicalProfile profile = profiles.getOrCreateProfile(userId);

    // Verify ownership
    if (!doc.getPatientProfileId().equals(profile.getId())) {
      throw new IllegalArgumentException("Access denied to this document");
    }

    try {
      Path file = rootLocation.resolve(doc.getFilePath()).normalize();
      Resource resource = new UrlResource(file.toUri());
      if (resource.exists() || resource.isReadable()) {
        return resource;
      } else {
        throw new RuntimeException("Could not read file");
      }
    } catch (Exception e) {
      throw new RuntimeException("Could not read file", e);
    }
  }
  
  public PatientMedicalDocument getDocument(Long documentId) {
      return docs.findById(documentId).orElseThrow(() -> new IllegalArgumentException("Document not found"));
  }

  public void deleteDocument(String userId, Long documentId) {
    PatientMedicalDocument doc =
        docs.findById(documentId).orElseThrow(() -> new IllegalArgumentException("Document not found"));
    PatientMedicalProfile profile = profiles.getOrCreateProfile(userId);

    // Verify ownership
    if (!doc.getPatientProfileId().equals(profile.getId())) {
      throw new IllegalArgumentException("Access denied to this document");
    }

    try {
      Path file = rootLocation.resolve(doc.getFilePath()).normalize();
      Files.deleteIfExists(file);
      docs.delete(doc);
    } catch (IOException e) {
      throw new RuntimeException("Could not delete file", e);
    }
  }
}
