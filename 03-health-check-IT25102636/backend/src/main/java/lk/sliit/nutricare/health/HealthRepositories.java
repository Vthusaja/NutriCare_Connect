package lk.sliit.nutricare.health;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

interface HealthCheckRepository extends JpaRepository<HealthCheck, UUID> {
  List<HealthCheck> findByPatientIdOrderByRecordedAtDesc(String patientId);
}

interface HealthAlertRepository extends JpaRepository<HealthAlert, UUID> {
  List<HealthAlert> findByStatusOrderByCreatedAtDesc(String status);

  void deleteByHealthCheckId(UUID healthCheckId);
}

