package lk.sliit.nutricare.appointment;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class AppointmentController {
  private final SlotRepository slots;
  private final AppointmentRepository appointments;
  private final AppointmentService service;

  AppointmentController(
      SlotRepository slots, AppointmentRepository appointments, AppointmentService service) {
    this.slots = slots;
    this.appointments = appointments;
    this.service = service;
  }

  @GetMapping("/schedules/slots")
  List<AvailabilitySlot> slots(@RequestParam LocalDate date) {
    return slots.findByStartTimeBetweenOrderByStartTime(
        date.atStartOfDay(), date.plusDays(1).atStartOfDay());
  }

  @PostMapping("/schedules/slots")
  @PreAuthorize(
      "hasAnyRole('DOCTOR','DIETITIAN','RECEPTION_STAFF','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR')")
  @ResponseStatus(HttpStatus.CREATED)
  AvailabilitySlot createSlot(
      Authentication authentication, @Valid @RequestBody CreateSlotRequest request) {
    String practitionerId = resolvePractitionerForCreate(authentication, request.practitionerId());
    int duration = request.durationMinutes() == null ? 60 : request.durationMinutes();
    return service.createSlot(practitionerId, request.startTime(), duration);
  }

  @PutMapping("/schedules/slots/{id}")
  @PreAuthorize(
      "hasAnyRole('DOCTOR','DIETITIAN','RECEPTION_STAFF','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR')")
  AvailabilitySlot updateSlot(
      Authentication authentication,
      @PathVariable UUID id,
      @Valid @RequestBody UpdateSlotRequest request) {
    AvailabilitySlot existing = service.requireSlot(id);
    requireSlotManageAccess(authentication, existing.getPractitionerId());
    int duration =
        request.durationMinutes() == null ? existing.getDurationMinutes() : request.durationMinutes();
    return service.updateSlot(id, request.startTime(), duration);
  }

  @DeleteMapping("/schedules/slots/{id}")
  @PreAuthorize(
      "hasAnyRole('DOCTOR','DIETITIAN','RECEPTION_STAFF','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR')")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void deleteSlot(Authentication authentication, @PathVariable UUID id) {
    AvailabilitySlot existing = service.requireSlot(id);
    requireSlotManageAccess(authentication, existing.getPractitionerId());
    service.deleteSlot(id);
  }

  @PostMapping("/appointments/hold")
  @PreAuthorize(
      "hasAnyRole('RECEPTION_STAFF','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR') or"
          + " (hasRole('PATIENT') and principal == #request.patientId.toString())")
  @ResponseStatus(HttpStatus.CREATED)
  AppointmentService.Booking hold(@Valid @RequestBody HoldRequest request) {
    return service.hold(
        request.slotId(), request.patientId(), request.serviceType(), request.amount());
  }

  @PostMapping("/appointments/{id}/payments")
  @PreAuthorize(
      "hasAnyRole('PATIENT','RECEPTION_STAFF','FINANCE_EXECUTIVE','SYSTEM_ADMIN')")
  @ResponseStatus(HttpStatus.CREATED)
  Payment pay(
      Authentication authentication,
      @PathVariable UUID id,
      @Valid @RequestBody PaymentRequest request) {
    requirePatientOwnership(authentication, id);
    return service.pay(id, request.amount(), request.method(), request.status());
  }

  @PostMapping("/appointments/{id}/cancel")
  @PreAuthorize(
      "hasAnyRole('PATIENT','RECEPTION_STAFF','DOCTOR','DIETITIAN','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR')")
  void cancel(Authentication authentication, @PathVariable UUID id) {
    requireCancelAccess(authentication, id);
    service.cancel(id);
  }

  @DeleteMapping("/appointments/{id}")
  @PreAuthorize(
      "hasAnyRole('PATIENT','RECEPTION_STAFF','DOCTOR','DIETITIAN','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR')")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void deleteAppointment(Authentication authentication, @PathVariable UUID id) {
    requireCancelAccess(authentication, id);
    service.cancel(id);
  }

  @GetMapping("/appointments/{id}")
  @PreAuthorize(
      "hasAnyRole('PATIENT','RECEPTION_STAFF','DOCTOR','DIETITIAN','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR')")
  Appointment getAppointment(Authentication authentication, @PathVariable UUID id) {
    requireCancelAccess(authentication, id);
    return service.requireAppointment(id);
  }

  @GetMapping("/appointments")
  @PreAuthorize(
      "hasAnyRole('RECEPTION_STAFF','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR')")
  List<Appointment> getAllAppointments() {
    return service.getAllAppointments();
  }

  @PutMapping("/appointments/{id}")
  @PreAuthorize(
      "hasAnyRole('PATIENT','RECEPTION_STAFF','DOCTOR','DIETITIAN','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR')")
  Appointment reschedule(
      Authentication authentication,
      @PathVariable UUID id,
      @Valid @RequestBody RescheduleRequest request) {
    requireCancelAccess(authentication, id);
    return service.reschedule(id, request.newSlotId());
  }

  @GetMapping("/appointments/patient/{patientId}")
  @PreAuthorize(
      "hasRole('RECEPTION_STAFF') or (hasRole('PATIENT') and principal == #patientId.toString())")
  List<Appointment> patient(@PathVariable String patientId) {
    return appointments.findByPatientId(patientId);
  }

  private String resolvePractitionerForCreate(Authentication authentication, String requested) {
    String role = roleOf(authentication);
    if ("DOCTOR".equals(role) || "DIETITIAN".equals(role)) {
      return authentication.getName();
    }
    if (requested == null || requested.isBlank()) {
      throw new IllegalArgumentException("Select a practitioner for the slot");
    }
    return requested;
  }

  private void requireSlotManageAccess(Authentication authentication, String practitionerId) {
    String role = roleOf(authentication);
    if ("DOCTOR".equals(role) || "DIETITIAN".equals(role)) {
      if (!authentication.getName().equals(practitionerId)) {
        throw new AccessDeniedException("You can only manage your own availability");
      }
    }
  }

  private void requirePatientOwnership(Authentication authentication, UUID appointmentId) {
    if ("PATIENT".equals(roleOf(authentication))) {
      Appointment appointment = service.requireAppointment(appointmentId);
      if (!appointment.getPatientId().equals(authentication.getName())) {
        throw new AccessDeniedException("Patient record is not owned by this account");
      }
    }
  }

  private void requireCancelAccess(Authentication authentication, UUID appointmentId) {
    String role = roleOf(authentication);
    Appointment appointment = service.requireAppointment(appointmentId);
    if ("PATIENT".equals(role) && !appointment.getPatientId().equals(authentication.getName())) {
      throw new AccessDeniedException("Patient record is not owned by this account");
    }
    if (("DOCTOR".equals(role) || "DIETITIAN".equals(role))
        && !appointment.getPractitionerId().equals(authentication.getName())) {
      throw new AccessDeniedException("Appointment is not assigned to this practitioner");
    }
  }

  private String roleOf(Authentication authentication) {
    return authentication.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");
  }

  record CreateSlotRequest(
      String practitionerId,
      @NotNull LocalDateTime startTime,
      Integer durationMinutes) {}

  record UpdateSlotRequest(
      @NotNull LocalDateTime startTime, Integer durationMinutes) {}

  record HoldRequest(
      @NotNull UUID slotId,
      @NotBlank String patientId,
      @NotBlank String serviceType,
      @NotNull @DecimalMin("0.00") BigDecimal amount) {}

  record PaymentRequest(
      @NotNull @DecimalMin("0.00") BigDecimal amount,
      @NotBlank String method,
      @NotBlank String status) {}

  record RescheduleRequest(
      @NotNull UUID newSlotId) {}
}
