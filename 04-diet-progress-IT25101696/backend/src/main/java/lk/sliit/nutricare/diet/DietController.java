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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PostAuthorize;

@RestController
@RequestMapping("/api/v1")
public class DietController {
  private final DietPlanRepository plans;
  private final ProgressLogRepository logs;

  DietController(DietPlanRepository plans, ProgressLogRepository logs) {
    this.plans = plans;
    this.logs = logs;
  }

  @PostMapping("/diet-plans")
  @PreAuthorize("hasAnyRole('DIETITIAN','DOCTOR')")
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

  @PostMapping("/diet-plans/{id}/publish")
  @PreAuthorize("hasAnyRole('DIETITIAN','DOCTOR')")
  DietPlan publish(Principal principal, @PathVariable UUID id) {
    DietPlan plan = plans.findById(id).orElseThrow();
    if (!plan.getDietitianId().equals(principal.getName()))
      throw new IllegalArgumentException("Only the plan author can publish it");
    plan.publish();
    return plans.save(plan);
  }

  @GetMapping("/diet-plans/patient/{id}")
  @PreAuthorize(
      "hasAnyRole('DIETITIAN','DOCTOR') or (hasRole('PATIENT') and principal == #id.toString())")
  List<DietPlan> plans(@PathVariable String id) {
    return plans.findByPatientIdOrderByCreatedAtDesc(id);
  }

  @GetMapping("/diet-plans/{id}")
  @PostAuthorize("hasAnyRole('DIETITIAN','DOCTOR') or (hasRole('PATIENT') and returnObject.patientId == principal)")
  DietPlan getPlan(@PathVariable UUID id) {
    return plans.findById(id).orElseThrow();
  }

  @PutMapping("/diet-plans/{id}")
  @PreAuthorize("hasAnyRole('DIETITIAN','DOCTOR')")
  DietPlan update(Principal principal, @PathVariable UUID id, @Valid @RequestBody PlanRequest request) {
    DietPlan plan = plans.findById(id).orElseThrow();
    if (!plan.getDietitianId().equals(principal.getName()))
      throw new IllegalArgumentException("Only the plan author can update it");
    plan.update(request.title(), request.calorieTarget(), request.exclusions(), request.mealSchedule());
    return plans.save(plan);
  }

  @DeleteMapping("/diet-plans/{id}")
  @PreAuthorize("hasAnyRole('DIETITIAN','DOCTOR')")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(Principal principal, @PathVariable UUID id) {
    DietPlan plan = plans.findById(id).orElseThrow();
    if (!plan.getDietitianId().equals(principal.getName()))
      throw new IllegalArgumentException("Only the plan author can delete it");
    plans.delete(plan);
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

  record LogRequest(
      @NotNull String patientId,
      UUID dietPlanId,
      @NotNull LocalDate date,
      @Positive BigDecimal weightKg,
      @Positive BigDecimal bmi,
      @Min(0) @Max(30) Integer waterGlasses,
      @Min(0) Integer mealsCompleted) {}
}
