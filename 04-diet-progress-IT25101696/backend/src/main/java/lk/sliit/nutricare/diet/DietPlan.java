package lk.sliit.nutricare.diet;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "diet_plans")
public class DietPlan {
  @Id private UUID id;

  @Column(nullable = false, length = 16)
  private String patientId;

  @Column(nullable = false, length = 16)
  private String dietitianId;

  @Column(nullable = false)
  private String title;

  private Integer calorieTarget;
  private String exclusions;

  @Column(length = 3000)
  private String mealSchedule;

  @Column(nullable = false)
  private String status;

  @Column(nullable = false)
  private Instant createdAt;

  protected DietPlan() {}

  public DietPlan(
      String patientId,
      String dietitianId,
      String title,
      Integer calories,
      String exclusions,
      String schedule) {
    id = UUID.randomUUID();
    this.patientId = patientId;
    this.dietitianId = dietitianId;
    this.title = title;
    calorieTarget = calories;
    this.exclusions = exclusions;
    mealSchedule = schedule;
    status = "DRAFT";
    createdAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public String getPatientId() {
    return patientId;
  }

  public String getDietitianId() {
    return dietitianId;
  }

  public String getTitle() {
    return title;
  }

  public Integer getCalorieTarget() {
    return calorieTarget;
  }

  public String getExclusions() {
    return exclusions;
  }

  public String getMealSchedule() {
    return mealSchedule;
  }

  public String getStatus() {
    return status;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void publish() {
    status = "PUBLISHED";
  }

  public void updateDetails(
      String title, Integer calories, String exclusions, String schedule, String status) {
    if (title != null && !title.isBlank()) this.title = title;
    if (calories != null) this.calorieTarget = calories;
    if (exclusions != null) this.exclusions = exclusions;
    if (schedule != null && !schedule.isBlank()) this.mealSchedule = schedule;
    if (status != null && !status.isBlank()) this.status = status;
  }
}
