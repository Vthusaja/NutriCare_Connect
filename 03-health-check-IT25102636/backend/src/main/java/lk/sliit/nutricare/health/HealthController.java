package lk.sliit.nutricare.health;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.security.Principal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class HealthController {
  private final HealthCheckRepository checks;
  private final HealthAlertRepository alerts;

  HealthController(HealthCheckRepository checks, HealthAlertRepository alerts) {
    this.checks = checks;
    this.alerts = alerts;
  }

  @PostMapping("/checkups")
  @PreAuthorize("hasAnyRole('DOCTOR','MEDICAL_CENTER_COORDINATOR')")
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  public Result create(Principal principal, @Valid @RequestBody CheckRequest request) {
    HealthCheck check =
        checks.save(
            new HealthCheck(
                request.patientId(),
                principal.getName(),
                request.weightKg(),
                request.bmi(),
                request.systolic(),
                request.diastolic(),
                request.bloodSugar(),
                request.temperature(),
                request.notes()));
    List<HealthAlert> created = new ArrayList<>();
    if (request.bloodSugar() != null && request.bloodSugar().compareTo(new BigDecimal("140")) > 0)
      created.add(
          alerts.save(
              new HealthAlert(
                  check.getId(),
                  request.patientId(),
                  "HIGH",
                  "Blood sugar exceeds the demo threshold of 140 mg/dL")));
    if (request.systolic() != null && request.systolic() > 140)
      created.add(
          alerts.save(
              new HealthAlert(
                  check.getId(),
                  request.patientId(),
                  "MEDIUM",
                  "Blood pressure exceeds the demo threshold")));
    return new Result(
        check, created, "Thresholds are demonstration values and are not diagnostic.");
  }

  @GetMapping("/checkups/patient/{id}")
  @PreAuthorize(
      "hasAnyRole('DIETITIAN','DOCTOR','MEDICAL_CENTER_COORDINATOR') or (hasRole('PATIENT') and"
          + " principal == #id.toString())")
  List<HealthCheck> history(@PathVariable String id) {
    return checks.findByPatientIdOrderByRecordedAtDesc(id);
  }

  @GetMapping("/health-alerts")
  @PreAuthorize("hasAnyRole('DIETITIAN','DOCTOR','MEDICAL_CENTER_COORDINATOR')")
  List<HealthAlert> alerts() {
    return alerts.findByStatusOrderByCreatedAtDesc("OPEN");
  }

  @GetMapping("/checkups/{id}")
  @PreAuthorize("hasAnyRole('DIETITIAN','DOCTOR','MEDICAL_CENTER_COORDINATOR')")
  public HealthCheck getCheckup(@PathVariable java.util.UUID id) {
    return checks
        .findById(id)
        .orElseThrow(
            () -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND));
  }

  @PutMapping("/checkups/{id}")
  @PreAuthorize("hasAnyRole('DOCTOR','MEDICAL_CENTER_COORDINATOR')")
  @Transactional
  public HealthCheck updateCheckup(
      @PathVariable java.util.UUID id, @Valid @RequestBody CheckRequest request) {
    HealthCheck check =
        checks
            .findById(id)
            .orElseThrow(
                () -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND));
    
    check.setWeightKg(request.weightKg());
    check.setBmi(request.bmi());
    check.setSystolic(request.systolic());
    check.setDiastolic(request.diastolic());
    check.setBloodSugar(request.bloodSugar());
    check.setTemperature(request.temperature());
    check.setNotes(request.notes());

    return checks.save(check);
  }

  @DeleteMapping("/checkups/{id}")
  @PreAuthorize("hasAnyRole('DOCTOR','MEDICAL_CENTER_COORDINATOR')")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void deleteCheckup(@PathVariable java.util.UUID id) {
    HealthCheck check =
        checks
            .findById(id)
            .orElseThrow(
                () -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND));
    checks.delete(check);
  }

  record CheckRequest(
      @NotNull String patientId,
      @Positive BigDecimal weightKg,
      @Positive BigDecimal bmi,
      @Positive Integer systolic,
      @Positive Integer diastolic,
      @Positive BigDecimal bloodSugar,
      @Positive BigDecimal temperature,
      String notes) {}

  record Result(HealthCheck check, List<HealthAlert> alerts, String disclaimer) {}
}
