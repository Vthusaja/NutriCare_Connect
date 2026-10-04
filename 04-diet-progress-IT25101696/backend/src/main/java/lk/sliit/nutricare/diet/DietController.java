package lk.sliit.nutricare.diet;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.security.Principal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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
public class DietController {
  private final DietPlanRepository plans;
  private final ProgressLogRepository logs;
  private final org.springframework.jdbc.core.JdbcTemplate jdbc;

  DietController(
      DietPlanRepository plans,
      ProgressLogRepository logs,
      org.springframework.jdbc.core.JdbcTemplate jdbc) {
    this.plans = plans;
    this.logs = logs;
    this.jdbc = jdbc;
  }

  @PostMapping("/diet-plans")
  @PreAuthorize("hasAnyRole('DIETITIAN','DOCTOR','SYSTEM_ADMIN')")
  @ResponseStatus(HttpStatus.CREATED)
  DietPlan create(Principal principal, @Valid @RequestBody PlanRequest request) {
    return plans.save(
        new DietPlan(
            request.patientId(),
            principal.getName(),
            request.title(),
            request.calorieTarget(),
            request.exclusions(),
            request.mealSchedule()));
  }

  @PutMapping("/diet-plans/{id}")
  @PreAuthorize("hasAnyRole('DIETITIAN','DOCTOR','SYSTEM_ADMIN')")
  DietPlan update(
      @PathVariable UUID id, @Valid @RequestBody UpdatePlanRequest request) {
    DietPlan plan =
        plans.findById(id).orElseThrow(() -> new IllegalArgumentException("Diet plan not found"));
    plan.updateDetails(
        request.title(),
        request.calorieTarget(),
        request.exclusions(),
        request.mealSchedule(),
        request.status());
    return plans.save(plan);
  }

  @DeleteMapping("/diet-plans/{id}")
  @PreAuthorize("hasAnyRole('DIETITIAN','DOCTOR','SYSTEM_ADMIN')")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @org.springframework.transaction.annotation.Transactional
  void delete(@PathVariable UUID id) {
    DietPlan plan =
        plans.findById(id).orElseThrow(() -> new IllegalArgumentException("Diet plan not found"));
    jdbc.update("UPDATE progress_logs SET diet_plan_id = NULL WHERE diet_plan_id = ?", id.toString());
    plans.delete(plan);
  }

  @PostMapping("/diet-plans/{id}/publish")
  @PreAuthorize("hasAnyRole('DIETITIAN','DOCTOR','SYSTEM_ADMIN')")
  DietPlan publish(Principal principal, @PathVariable UUID id) {
    DietPlan plan = plans.findById(id).orElseThrow();
    plan.publish();
    return plans.save(plan);
  }

  @GetMapping("/diet-plans/patient/{id}")
  @PreAuthorize(
      "hasAnyRole('DIETITIAN','DOCTOR','SYSTEM_ADMIN') or (hasRole('PATIENT') and principal == #id.toString())")
  List<DietPlan> plans(@PathVariable String id) {
    return plans.findByPatientIdOrderByCreatedAtDesc(id);
  }

  @PostMapping("/progress-logs")
  @PreAuthorize("hasRole('PATIENT') and principal == #request.patientId.toString()")
  @ResponseStatus(HttpStatus.CREATED)
  ProgressLog log(@Valid @RequestBody LogRequest request) {
    return logs.save(
        new ProgressLog(
            request.patientId(),
            request.dietPlanId(),
            request.date(),
            request.weightKg(),
            request.bmi(),
            request.waterGlasses(),
            request.mealsCompleted()));
  }

  @GetMapping("/progress-logs/patient/{id}")
  @PreAuthorize(
      "hasAnyRole('DIETITIAN','DOCTOR') or (hasRole('PATIENT') and principal == #id.toString())")
  List<ProgressLog> progress(@PathVariable String id) {
    return logs.findByPatientIdOrderByLogDateAsc(id);
  }

  record PlanRequest(
      @NotNull String patientId,
      @NotBlank String title,
      @Positive Integer calorieTarget,
      String exclusions,
      @NotBlank String mealSchedule) {}

  record UpdatePlanRequest(
      @NotBlank String title,
      @Positive Integer calorieTarget,
      String exclusions,
      @NotBlank String mealSchedule,
      String status) {}

  record LogRequest(
      @NotNull String patientId,
      UUID dietPlanId,
      @NotNull LocalDate date,
      @Positive BigDecimal weightKg,
      @Positive BigDecimal bmi,
      @Min(0) @Max(30) Integer waterGlasses,
      @Min(0) Integer mealsCompleted) {}
}
