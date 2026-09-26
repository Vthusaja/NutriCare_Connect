package lk.sliit.nutricare.message;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notifications")
public class Notification {
  @Id private UUID id;

  @Column(nullable = false, length = 16)
  private String recipientId;

  @Column(nullable = false)
  private String type;

  @Column(nullable = false)
  private String channel;

  @Column(nullable = false)
  private String message;

  @Column(nullable = false)
  private String status;

  @Column(nullable = false)
  private int attempts;

  private Instant retryAt;

  @Column(nullable = false)
  private Instant createdAt;

  protected Notification() {}

  public Notification(
      String recipient, String type, String channel, String message, String status) {
    id = UUID.randomUUID();
    recipientId = recipient;
    this.type = type;
    this.channel = channel;
    this.message = message;
    this.status = status;
    attempts = 1;
    createdAt = Instant.now();
    if ("FAILED".equals(status)) retryAt = Instant.now().plusSeconds(300);
  }

  public UUID getId() {
    return id;
  }

  public String getRecipientId() {
    return recipientId;
  }

  public String getType() {
    return type;
  }

  public String getChannel() {
    return channel;
  }

  public String getMessage() {
    return message;
  }

  public String getStatus() {
    return status;
  }

  public int getAttempts() {
    return attempts;
  }

  public Instant getRetryAt() {
    return retryAt;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void markAsRead() {
    this.status = "READ";
  }

  public void retry() {
    attempts++;
    status = "DELIVERED_SIMULATED";
    retryAt = null;
  }
}
