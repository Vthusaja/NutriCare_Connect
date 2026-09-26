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

  AppointmentService(
      SlotRepository slots,
      AppointmentRepository appointments,
      InvoiceRepository invoices,
      PaymentRepository payments) {
    this.slots = slots;
    this.appointments = appointments;
    this.invoices = invoices;
    this.payments = payments;
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
  public void cancel(UUID appointmentId) {
    Appointment appointment = appointments.findById(appointmentId).orElseThrow();
    if ("CANCELLED".equals(appointment.getStatus())) {
      return;
    }
    if ("EXPIRED".equals(appointment.getStatus())) {
      throw new IllegalStateException("Expired appointments cannot be cancelled");
    }
    appointment.cancel();
    slots.findForUpdate(appointment.getSlotId()).ifPresent(AvailabilitySlot::release);
    invoices
        .findByAppointmentId(appointmentId)
        .ifPresent(invoice -> invoice.setStatus("CANCELLED"));
  }

  public java.util.List<Appointment> getAllAppointments() {
    return appointments.findAll();
  }

  @Transactional
  public Appointment reschedule(UUID appointmentId, UUID newSlotId) {
    Appointment appointment = requireAppointment(appointmentId);
    if ("CANCELLED".equals(appointment.getStatus()) || "EXPIRED".equals(appointment.getStatus())) {
      throw new IllegalStateException("Cannot reschedule cancelled or expired appointment");
    }

    AvailabilitySlot oldSlot = slots.findForUpdate(appointment.getSlotId()).orElseThrow();
    AvailabilitySlot newSlot = slots.findForUpdate(newSlotId).orElseThrow(() -> new IllegalArgumentException("New slot not found"));

    if (!newSlot.canHold()) {
      throw new IllegalStateException("New slot is not available");
    }

    oldSlot.release();

    if ("CONFIRMED".equals(appointment.getStatus())) {
      newSlot.hold(); // we have to hold before book
      newSlot.book();
    } else {
      newSlot.hold();
    }

    appointment.reschedule(newSlot);
    return appointment;
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

  public Invoice requireInvoice(UUID invoiceId) {
    return invoices
        .findById(invoiceId)
        .orElseThrow(() -> new IllegalArgumentException("Invoice not found"));
  }

  @Transactional
  public Invoice updateInvoice(UUID invoiceId, String status) {
    Invoice invoice = requireInvoice(invoiceId);
    invoice.setStatus(status);
    return invoice;
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
