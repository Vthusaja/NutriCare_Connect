package lk.sliit.nutricare.message;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "secure_messages")
public class SecureMessage {
  @Id private UUID id;

  @Column(nullable = false, length = 16)
  private String senderId;

  @Column(nullable = false, length = 16)
  private String recipientId;

  @Column(nullable = false, length = 16)
  private String patientId;

  @Column(nullable = false, length = 2000)
  private String body;

  @Column(nullable = false)
  private Instant sentAt;

  protected SecureMessage() {}

  public SecureMessage(String senderId, String recipientId, String patientId, String body) {
    id = UUID.randomUUID();
    this.senderId = senderId;
    this.recipientId = recipientId;
    this.patientId = patientId;
    this.body = body;
    sentAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public String getSenderId() {
    return senderId;
  }

  public String getRecipientId() {
    return recipientId;
  }

  public String getPatientId() {
    return patientId;
  }

  public String getBody() {
    return body;
  }

  public Instant getSentAt() {
    return sentAt;
  }

  public void setBody(String body) {
    this.body = body;
  }
}
