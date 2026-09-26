package lk.sliit.nutricare.health;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "health_checks")
public class HealthCheck {
  @Id private UUID id;

  @Column(nullable = false, length = 16)
  private String patientId;

  @Column(nullable = false, length = 16)
  private String practitionerId;

  private BigDecimal weightKg;
  private BigDecimal bmi;
  private Integer systolic;
  private Integer diastolic;
  private BigDecimal bloodSugar;
  private BigDecimal temperature;

  @Column(length = 2000)
  private String notes;

  @Column(nullable = false)
  private Instant recordedAt;

  protected HealthCheck() {}

  public HealthCheck(
      String patientId,
      String practitionerId,
      BigDecimal weightKg,
      BigDecimal bmi,
      Integer systolic,
      Integer diastolic,
      BigDecimal bloodSugar,
      BigDecimal temperature,
      String notes) {
    id = UUID.randomUUID();
    this.patientId = patientId;
    this.practitionerId = practitionerId;
    this.weightKg = weightKg;
    this.bmi = bmi;
    this.systolic = systolic;
    this.diastolic = diastolic;
    this.bloodSugar = bloodSugar;
    this.temperature = temperature;
    this.notes = notes;
    recordedAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public String getPatientId() {
    return patientId;
  }

  public String getPractitionerId() {
    return practitionerId;
  }

  public BigDecimal getWeightKg() {
    return weightKg;
  }

  public BigDecimal getBmi() {
    return bmi;
  }

  public Integer getSystolic() {
    return systolic;
  }

  public Integer getDiastolic() {
    return diastolic;
  }

  public BigDecimal getBloodSugar() {
    return bloodSugar;
  }

  public BigDecimal getTemperature() {
    return temperature;
  }

  public String getNotes() {
    return notes;
  }

  public Instant getRecordedAt() {
    return recordedAt;
  }

  public void setWeightKg(BigDecimal weightKg) {
    this.weightKg = weightKg;
  }

  public void setBmi(BigDecimal bmi) {
    this.bmi = bmi;
  }

  public void setSystolic(Integer systolic) {
    this.systolic = systolic;
  }

  public void setDiastolic(Integer diastolic) {
    this.diastolic = diastolic;
  }

  public void setBloodSugar(BigDecimal bloodSugar) {
    this.bloodSugar = bloodSugar;
  }

  public void setTemperature(BigDecimal temperature) {
    this.temperature = temperature;
  }

  public void setNotes(String notes) {
    this.notes = notes;
  }
}
