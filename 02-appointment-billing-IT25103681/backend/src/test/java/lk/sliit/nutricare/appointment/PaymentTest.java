package lk.sliit.nutricare.appointment;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PaymentTest {

  @Mock private SlotRepository slots;
  @Mock private AppointmentRepository appointments;
  @Mock private InvoiceRepository invoices;
  @Mock private PaymentRepository payments;

  private AppointmentService service;

  @BeforeEach
  void setUp() {
    service = new AppointmentService(slots, appointments, invoices, payments, null);
  }

  @Test
  void testSuccessfulPaymentScenario() {
    UUID slotId = UUID.randomUUID();
    UUID apptId = UUID.randomUUID();

    AvailabilitySlot slot = new AvailabilitySlot("D001", LocalDateTime.now().plusDays(1));
    slot.hold(); // status = HELD

    Appointment appointment = new Appointment(slot, "P001", "Health check-up");
    Invoice invoice = new Invoice(apptId, new BigDecimal("3500.00"));

    when(appointments.findById(apptId)).thenReturn(Optional.of(appointment));
    when(invoices.findByAppointmentId(apptId)).thenReturn(Optional.of(invoice));
    when(slots.findForUpdate(any())).thenReturn(Optional.of(slot));
    when(payments.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));

    // Execute payment save scenario
    Payment payment = service.pay(apptId, new BigDecimal("3500.00"), "CARD", "PAID");

    // Verify payment details
    assertNotNull(payment);
    assertNotNull(payment.getId());
    assertTrue(payment.getReference().startsWith("DEMO-"));
    assertEquals(new BigDecimal("3500.00"), payment.getAmount());
    assertEquals("CARD", payment.getMethod());
    assertEquals("PAID", payment.getStatus());

    // Verify appointment status was confirmed
    assertEquals("CONFIRMED", appointment.getStatus());

    // Verify invoice status was updated to PAID
    assertEquals("PAID", invoice.getStatus());

    // Verify slot status was updated to BOOKED
    assertEquals("BOOKED", slot.getStatus());

    // Verify repository calls
    verify(payments).save(any(Payment.class));
    verify(invoices).save(invoice);
    verify(appointments).save(appointment);
  }

  @Test
  void testPaymentWithCashMethod() {
    UUID apptId = UUID.randomUUID();
    AvailabilitySlot slot = new AvailabilitySlot("D001", LocalDateTime.now().plusDays(1));
    slot.hold();
    Appointment appointment = new Appointment(slot, "P001", "Diet Consultation");
    Invoice invoice = new Invoice(apptId, new BigDecimal("4500.00"));

    when(appointments.findById(apptId)).thenReturn(Optional.of(appointment));
    when(invoices.findByAppointmentId(apptId)).thenReturn(Optional.of(invoice));
    when(slots.findForUpdate(any())).thenReturn(Optional.of(slot));
    when(payments.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));

    Payment payment = service.pay(apptId, new BigDecimal("4500.00"), "CASH", "PAID");

    assertEquals("CASH", payment.getMethod());
    assertEquals("PAID", payment.getStatus());
    assertEquals("CONFIRMED", appointment.getStatus());
  }

  @Test
  void testPaymentForCancelledAppointmentFails() {
    UUID apptId = UUID.randomUUID();
    AvailabilitySlot slot = new AvailabilitySlot("D001", LocalDateTime.now().plusDays(1));
    Appointment appointment = new Appointment(slot, "P001", "Health check-up");
    appointment.cancel();

    when(appointments.findById(apptId)).thenReturn(Optional.of(appointment));

    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class,
            () -> service.pay(apptId, new BigDecimal("3500.00"), "CARD", "PAID"));

    assertEquals("Cancelled or expired appointments cannot be paid", ex.getMessage());
  }

  @Test
  void testInvalidPaymentMethodFails() {
    UUID apptId = UUID.randomUUID();

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> service.pay(apptId, new BigDecimal("3500.00"), "INVALID_METHOD", "PAID"));

    assertEquals("Unsupported demo payment method", ex.getMessage());
  }
}
