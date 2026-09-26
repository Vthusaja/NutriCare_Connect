package lk.sliit.nutricare.access;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientMedicalProfileRepository extends JpaRepository<PatientMedicalProfile, Long> {
  Optional<PatientMedicalProfile> findByUserAccountId(String userAccountId);
}
