package lk.sliit.nutricare.appointment;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppointmentService {
  private static final Set<String> PAYMENT_METHODS =
      Set.of("CARD", "CASH", "BANK_TRANSFER", "MOBILE_WALLET");
  private static final Set<String> PAYMENT_STATUSES =
      Set.of("PAID", "PENDING", "PARTIALLY_PAID", "FAILED", "REFUNDED");

  private final SlotRepository slots;
  private final AppointmentRepository appointments;
  private final InvoiceRepository invoices;
  private final PaymentRepository payments;
  private final org.springframework.jdbc.core.JdbcTemplate jdbc;

  AppointmentService(
      SlotRepository slots,
      AppointmentRepository appointments,
      InvoiceRepository invoices,
      PaymentRepository payments,
      org.springframework.jdbc.core.JdbcTemplate jdbc) {
    this.slots = slots;
    this.appointments = appointments;
    this.invoices = invoices;
    this.payments = payments;
    this.jdbc = jdbc;
  }

  @Transactional
  public AvailabilitySlot createSlot(
      String practitionerId, LocalDateTime start, int durationMinutes) {
    validateSlotTiming(start, durationMinutes);
    assertNoOverlap(practitionerId, start, durationMinutes, null);
    try {
      return slots.save(new AvailabilitySlot(practitionerId, start, durationMinutes));
    } catch (DataIntegrityViolationException ex) {
      throw new IllegalArgumentException(
          "This time overlaps another open slot for this practitioner");
    }
  }

  @Transactional
  public AvailabilitySlot updateSlot(UUID slotId, LocalDateTime start, int durationMinutes) {
    validateSlotTiming(start, durationMinutes);
    AvailabilitySlot slot =
        slots.findById(slotId).orElseThrow(() -> new IllegalArgumentException("Slot not found"));
    assertNoOverlap(slot.getPractitionerId(), start, durationMinutes, slotId);
    try {
      slot.reschedule(start, durationMinutes);
      return slot;
    } catch (DataIntegrityViolationException ex) {
      throw new IllegalArgumentException(
          "This time overlaps another open slot for this practitioner");
    }
  }

  @Transactional
  public void deleteSlot(UUID slotId) {
    AvailabilitySlot slot =
        slots.findById(slotId).orElseThrow(() -> new IllegalArgumentException("Slot not found"));
    if (!"AVAILABLE".equals(slot.getStatus())) {
      throw new IllegalStateException("Only available slots can be removed");
    }
    slots.delete(slot);
  }

  @Transactional
  public Booking hold(UUID slotId, String patientId, String service, BigDecimal amount) {
    AvailabilitySlot slot =
        slots
            .findForUpdate(slotId)
            .orElseThrow(() -> new IllegalArgumentException("Slot not found"));
    slot.hold();
    Appointment appointment = appointments.save(new Appointment(slot, patientId, service));
    Invoice invoice = invoices.save(new Invoice(appointment.getId(), amount));
    return new Booking(appointment, invoice, slot);
  }

  @Transactional
  public Payment pay(UUID appointmentId, BigDecimal amount, String method, String status) {
    validatePayment(method, status);

    Appointment appointment = appointments.findById(appointmentId).orElseThrow();
    if ("CANCELLED".equals(appointment.getStatus()) || "EXPIRED".equals(appointment.getStatus())) {
      throw new IllegalStateException("Cancelled or expired appointments cannot be paid");
    }
    Invoice invoice = invoices.findByAppointmentId(appointmentId).orElseThrow();
    Payment payment = payments.save(new Payment(invoice.getId(), amount, method, status));

    if ("PAID".equals(status) || "PARTIALLY_PAID".equals(status)) {
      AvailabilitySlot slot = slots.findForUpdate(appointment.getSlotId()).orElseThrow();
      slot.book();
      appointment.confirm();
      invoice.setStatus(status);
    }
    return payment;
  }

  @Transactional
  public Appointment updateAppointment(
      UUID appointmentId, String serviceType, String status, BigDecimal amount) {
    Appointment appointment = requireAppointment(appointmentId);
    if (serviceType != null && !serviceType.isBlank()) {
      appointment.setServiceType(serviceType);
    }
    if (status != null && !status.isBlank()) {
      appointment.setStatus(status);
      if ("CONFIRMED".equals(status)) {
        slots.findForUpdate(appointment.getSlotId()).ifPresent(AvailabilitySlot::book);
      } else if ("CANCELLED".equals(status)) {
        slots.findForUpdate(appointment.getSlotId()).ifPresent(AvailabilitySlot::release);
      }
    }
    if (amount != null) {
      invoices.findByAppointmentId(appointmentId).ifPresent(inv -> {
        inv.setAmount(amount);
        invoices.save(inv);
      });
    }
    return appointments.save(appointment);
  }

  @Transactional
  public void deleteAppointment(UUID appointmentId) {
    Appointment appointment = requireAppointment(appointmentId);
    // Release the slot
    slots.findForUpdate(appointment.getSlotId()).ifPresent(AvailabilitySlot::release);

    // Clean up complaints and feedback referencing this appointment
    jdbc.update(
        "DELETE FROM complaints WHERE feedback_id IN (SELECT id FROM feedback WHERE appointment_id = ?)",
        appointmentId.toString());
    jdbc.update("DELETE FROM feedback WHERE appointment_id = ?", appointmentId.toString());

    // Clean up payments and invoices
    invoices.findByAppointmentId(appointmentId).ifPresent(inv -> {
      payments.deleteByInvoiceId(inv.getId());
      invoices.delete(inv);
    });

    appointments.delete(appointment);
  }

  @Transactional
  public void cancel(UUID appointmentId) {
    deleteAppointment(appointmentId);
  }

  @Scheduled(fixedDelay = 60000)
  @Transactional
  public void releaseExpired() {
    for (AvailabilitySlot slot : slots.findByStatusAndHoldExpiresAtBefore("HELD", Instant.now())) {
      appointments.findBySlotIdAndStatus(slot.getId(), "HELD").forEach(Appointment::expire);
      slot.release();
    }
  }

  public AvailabilitySlot requireSlot(UUID slotId) {
    return slots.findById(slotId).orElseThrow(() -> new IllegalArgumentException("Slot not found"));
  }

  public Appointment requireAppointment(UUID appointmentId) {
    return appointments
        .findById(appointmentId)
        .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
  }


  private void assertNoOverlap(
      String practitionerId, LocalDateTime start, int durationMinutes, UUID excludeId) {
    LocalDateTime end = start.plusMinutes(durationMinutes);
    if (slots.countOverlapping(practitionerId, start, end, excludeId) > 0) {
      throw new IllegalArgumentException(
          "This time overlaps another open slot for this practitioner. Pick a start time after the existing slot ends.");
    }
  }
  private void validateSlotTiming(LocalDateTime start, int durationMinutes) {
    if (start == null) {
      throw new IllegalArgumentException("Start time is required");
    }
    if (start.isBefore(LocalDateTime.now().minusMinutes(1))) {
      throw new IllegalArgumentException("Slot start time must be in the future");
    }
    if (durationMinutes < 15 || durationMinutes > 240) {
      throw new IllegalArgumentException("Duration must be between 15 and 240 minutes");
    }
  }

  private void validatePayment(String method, String status) {
    if (!PAYMENT_METHODS.contains(method)) {
      throw new IllegalArgumentException("Unsupported demo payment method");
    }
    if (!PAYMENT_STATUSES.contains(status)) {
      throw new IllegalArgumentException("Unsupported payment status");
    }
  }

  public record Booking(Appointment appointment, Invoice invoice, AvailabilitySlot slot) {}
}
