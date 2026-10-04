package lk.sliit.nutricare.appointment;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "appointments")
public class Appointment {
  @Id private UUID id;

  @Column(nullable = false)
  private UUID slotId;

  @Column(nullable = false, length = 16)
  private String patientId;

  @Column(nullable = false, length = 16)
  private String practitionerId;

  @Column(nullable = false)
  private String serviceType;

  @Column(nullable = false)
  private String status;

  @Column(nullable = false)
  private Instant createdAt;

  protected Appointment() {}

  public Appointment(AvailabilitySlot s, String patientId, String service) {
    id = UUID.randomUUID();
    slotId = s.getId();
    this.patientId = patientId;
    practitionerId = s.getPractitionerId();
    serviceType = service;
    status = "HELD";
    createdAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public UUID getSlotId() {
    return slotId;
  }

  public String getPatientId() {
    return patientId;
  }

  public String getPractitionerId() {
    return practitionerId;
  }

  public String getServiceType() {
    return serviceType;
  }

  public String getStatus() {
    return status;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void confirm() {
    status = "CONFIRMED";
  }

  public void cancel() {
    status = "CANCELLED";
  }

  public void expire() {
    status = "EXPIRED";
  }

  public void updateDetails(String serviceType, String status) {
    if (serviceType != null && !serviceType.isBlank()) {
      this.serviceType = serviceType;
    }
    if (status != null && !status.isBlank()) {
      this.status = status;
    }
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public void setServiceType(String serviceType) {
    this.serviceType = serviceType;
  }
}
