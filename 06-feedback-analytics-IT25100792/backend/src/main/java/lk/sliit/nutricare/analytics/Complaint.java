package lk.sliit.nutricare.analytics;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "complaints")
public class Complaint {
  @Id private UUID id;

  @Column(nullable = false)
  private UUID feedbackId;

  @Column(nullable = false)
  private String priority;

  @Column(nullable = false)
  private String status;

  @Column(nullable = false)
  private Instant createdAt;

  protected Complaint() {}

  public Complaint(UUID feedbackId) {
    id = UUID.randomUUID();
    this.feedbackId = feedbackId;
    priority = "URGENT";
    status = "OPEN";
    createdAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public UUID getFeedbackId() {
    return feedbackId;
  }

  public String getPriority() {
    return priority;
  }

  public String getStatus() {
    return status;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void update(String status, String priority) {
    if (status == null || status.isBlank()) {
      throw new IllegalArgumentException("status is required");
    }
    if (priority == null || priority.isBlank()) {
      throw new IllegalArgumentException("priority is required");
    }
    this.status = status.trim();
    this.priority = priority.trim();
  }
}
