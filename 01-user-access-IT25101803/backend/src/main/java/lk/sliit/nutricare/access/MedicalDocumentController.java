package lk.sliit.nutricare.access;

import java.security.Principal;
import java.util.List;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/patient/documents")
public class MedicalDocumentController {
  private final DocumentStorageService storage;

  public MedicalDocumentController(DocumentStorageService storage) {
    this.storage = storage;
  }

  @PostMapping("/upload")
  @PreAuthorize("hasRole('PATIENT')")
  public MedicalDocumentResponse upload(
      Principal principal,
      @RequestParam("title") String title,
      @RequestParam("category") String category,
      @RequestParam("file") MultipartFile file) {
    return storage.uploadDocument(principal.getName(), title, category, file);
  }

  @GetMapping
  @PreAuthorize("hasRole('PATIENT')")
  public List<MedicalDocumentResponse> listDocuments(Principal principal) {
    return storage.listDocuments(principal.getName());
  }

  @GetMapping("/{id}/download")
  @PreAuthorize("hasRole('PATIENT')")
  public ResponseEntity<Resource> download(Principal principal, @PathVariable Long id) {
    Resource file = storage.loadDocumentAsResource(principal.getName(), id);
    PatientMedicalDocument doc = storage.getDocument(id);
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(doc.getFileType()))
        .header(
            HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + doc.getFileName() + "\"")
        .body(file);
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasRole('PATIENT')")
  public ResponseEntity<Void> deleteDocument(Principal principal, @PathVariable Long id) {
    storage.deleteDocument(principal.getName(), id);
    return ResponseEntity.noContent().build();
  }
}
