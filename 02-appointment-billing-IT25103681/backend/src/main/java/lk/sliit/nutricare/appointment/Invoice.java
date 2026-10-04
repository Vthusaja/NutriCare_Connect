package lk.sliit.nutricare.appointment;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "invoices")
public class Invoice {
  @Id private UUID id;

  @Column(nullable = false, unique = true)
  private String invoiceNumber;

  @Column(nullable = false)
  private UUID appointmentId;

  @Column(nullable = false)
  private BigDecimal amount;

  @Column(nullable = false)
  private String status;

  @Column(nullable = false)
  private Instant createdAt;

  protected Invoice() {}

  public Invoice(UUID appointmentId, BigDecimal amount) {
    id = UUID.randomUUID();
    invoiceNumber = "INV-" + Instant.now().toEpochMilli();
    this.appointmentId = appointmentId;
    this.amount = amount;
    status = "PENDING";
    createdAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public String getInvoiceNumber() {
    return invoiceNumber;
  }

  public UUID getAppointmentId() {
    return appointmentId;
  }

  public BigDecimal getAmount() {
    return amount;
  }

  public String getStatus() {
    return status;
  }

  public void setAmount(BigDecimal amount) {
    this.amount = amount;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setStatus(String status) {
    this.status = status;
  }
}
