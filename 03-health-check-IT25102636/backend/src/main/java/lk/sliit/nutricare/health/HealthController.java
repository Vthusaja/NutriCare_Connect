package lk.sliit.nutricare.health;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.security.Principal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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
  @PreAuthorize("hasAnyRole('DOCTOR','DIETITIAN','MEDICAL_CENTER_COORDINATOR','SYSTEM_ADMIN')")
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

  @PutMapping("/checkups/{id}")
  @PreAuthorize("hasAnyRole('DOCTOR','DIETITIAN','MEDICAL_CENTER_COORDINATOR','SYSTEM_ADMIN')")
  @Transactional
  public Result update(
      @PathVariable UUID id, @Valid @RequestBody UpdateCheckRequest request) {
    HealthCheck check =
        checks.findById(id).orElseThrow(() -> new IllegalArgumentException("Health check not found"));
    check.updateDetails(
        request.weightKg(),
        request.bmi(),
        request.systolic(),
        request.diastolic(),
        request.bloodSugar(),
        request.temperature(),
        request.notes());
    checks.save(check);

    alerts.deleteByHealthCheckId(id);
    List<HealthAlert> created = new ArrayList<>();
    if (request.bloodSugar() != null && request.bloodSugar().compareTo(new BigDecimal("140")) > 0)
      created.add(
          alerts.save(
              new HealthAlert(
                  check.getId(),
                  check.getPatientId(),
                  "HIGH",
                  "Blood sugar exceeds the demo threshold of 140 mg/dL")));
    if (request.systolic() != null && request.systolic() > 140)
      created.add(
          alerts.save(
              new HealthAlert(
                  check.getId(),
                  check.getPatientId(),
                  "MEDIUM",
                  "Blood pressure exceeds the demo threshold")));
    return new Result(
        check, created, "Thresholds are demonstration values and are not diagnostic.");
  }

  @DeleteMapping("/checkups/{id}")
  @PreAuthorize("hasAnyRole('DOCTOR','DIETITIAN','MEDICAL_CENTER_COORDINATOR','SYSTEM_ADMIN')")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void delete(@PathVariable UUID id) {
    HealthCheck check =
        checks.findById(id).orElseThrow(() -> new IllegalArgumentException("Health check not found"));
    alerts.deleteByHealthCheckId(id);
    checks.delete(check);
  }

  @GetMapping("/checkups/patient/{id}")
  @PreAuthorize(
      "hasAnyRole('DIETITIAN','DOCTOR','MEDICAL_CENTER_COORDINATOR','SYSTEM_ADMIN') or (hasRole('PATIENT') and"
          + " principal == #id.toString())")
  List<HealthCheck> history(@PathVariable String id) {
    return checks.findByPatientIdOrderByRecordedAtDesc(id);
  }

  @GetMapping("/health-alerts")
  @PreAuthorize("hasAnyRole('DIETITIAN','DOCTOR','MEDICAL_CENTER_COORDINATOR','SYSTEM_ADMIN')")
  List<HealthAlert> alerts() {
    return alerts.findByStatusOrderByCreatedAtDesc("OPEN");
  }

  record CheckRequest(
      @NotNull String patientId,
      @NotNull @DecimalMin("1.0") @DecimalMax("500.0") BigDecimal weightKg,
      @NotNull @DecimalMin("5.0") @DecimalMax("100.0") BigDecimal bmi,
      @Min(40) @Max(300) Integer systolic,
      @Min(20) @Max(200) Integer diastolic,
      @NotNull @DecimalMin("1.0") @DecimalMax("1000.0") BigDecimal bloodSugar,
      @NotNull @DecimalMin("30.0") @DecimalMax("45.0") BigDecimal temperature,
      @Size(max = 2000) String notes) {}

  record UpdateCheckRequest(
      @NotNull @DecimalMin("1.0") @DecimalMax("500.0") BigDecimal weightKg,
      @NotNull @DecimalMin("5.0") @DecimalMax("100.0") BigDecimal bmi,
      @Min(40) @Max(300) Integer systolic,
      @Min(20) @Max(200) Integer diastolic,
      @NotNull @DecimalMin("1.0") @DecimalMax("1000.0") BigDecimal bloodSugar,
      @NotNull @DecimalMin("30.0") @DecimalMax("45.0") BigDecimal temperature,
      @Size(max = 2000) String notes) {}

  record Result(HealthCheck check, List<HealthAlert> alerts, String disclaimer) {}
}
