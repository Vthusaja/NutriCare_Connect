package lk.sliit.nutricare.access;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientMedicalDocumentRepository extends JpaRepository<PatientMedicalDocument, Long> {
  List<PatientMedicalDocument> findByPatientProfileId(Long patientProfileId);
}
