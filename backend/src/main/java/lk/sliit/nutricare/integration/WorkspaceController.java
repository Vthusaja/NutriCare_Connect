package lk.sliit.nutricare.integration;

import java.math.BigDecimal;
import java.security.Principal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
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
@RequestMapping("/api/v1/workspace")
public class WorkspaceController {
  private final JdbcTemplate jdbc;

  public WorkspaceController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping("/people")
  @PreAuthorize(
      "hasAnyRole('DIETITIAN','DOCTOR','RECEPTION_STAFF','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR','PATIENT','FINANCE_EXECUTIVE','OPERATIONS_MANAGER')")
  public List<PersonView> people(Authentication authentication) {
    String role = roleOf(authentication);
    String sql =
        """
        SELECT id, full_name, role, enabled
        FROM user_accounts
        WHERE enabled = TRUE
        """;
    Object[] parameters = new Object[0];
    if ("DOCTOR".equals(role) || "DIETITIAN".equals(role)) {
      sql += " AND role IN (?, ?, ?)";
      parameters = new Object[] {"PATIENT", "DOCTOR", "DIETITIAN"};
    } else if ("RECEPTION_STAFF".equals(role)) {
      sql += " AND role IN (?, ?, ?)";
      parameters = new Object[] {"PATIENT", "DIETITIAN", "DOCTOR"};
    } else if ("PATIENT".equals(role)) {
      sql += " AND role IN (?, ?)";
      parameters = new Object[] {"DIETITIAN", "DOCTOR"};
    }
    sql += " ORDER BY role, full_name";
    return jdbc.query(
        sql,
        (row, ignored) ->
            new PersonView(
                row.getString("id"),
                row.getString("full_name"),
                row.getString("role"),
                row.getBoolean("enabled")),
        parameters);
  }

  @GetMapping("/appointments")
  public List<AppointmentView> appointments(Authentication authentication) {
    String role = roleOf(authentication);
    String sql =
        """
        SELECT a.id, a.patient_id, patient.full_name patient_name,
               a.practitioner_id, practitioner.full_name practitioner_name,
               a.service_type, a.status, a.created_at, s.start_time,
               i.invoice_number, i.amount, i.status invoice_status
        FROM appointments a
        JOIN availability_slots s ON s.id = a.slot_id
        JOIN user_accounts patient ON patient.id = a.patient_id
        JOIN user_accounts practitioner ON practitioner.id = a.practitioner_id
        LEFT JOIN invoices i ON i.appointment_id = a.id
        """;
    Object[] parameters = new Object[0];
    if ("PATIENT".equals(role)) {
      sql += " WHERE a.patient_id = ?";
      parameters = new Object[] {authentication.getName()};
    } else if ("DOCTOR".equals(role) || "DIETITIAN".equals(role)) {
      sql += " WHERE a.practitioner_id = ?";
      parameters = new Object[] {authentication.getName()};
    }
    sql += " ORDER BY s.start_time DESC";
    return jdbc.query(
        sql,
        (row, ignored) ->
            new AppointmentView(
                row.getString("id"),
                row.getString("patient_id"),
                row.getString("patient_name"),
                row.getString("practitioner_id"),
                row.getString("practitioner_name"),
                row.getString("service_type"),
                row.getString("status"),
                toDateTime(row.getTimestamp("start_time")),
                row.getString("invoice_number"),
                row.getBigDecimal("amount"),
                row.getString("invoice_status")),
        parameters);
  }

  @GetMapping("/slots")
  public List<SlotView> slots(Authentication authentication, @RequestParam LocalDate date) {
    String role = roleOf(authentication);
    String sql =
        """
        SELECT s.id, s.practitioner_id, u.full_name practitioner_name,
               s.start_time, s.duration_minutes, s.status
        FROM availability_slots s
        JOIN user_accounts u ON u.id = s.practitioner_id
        WHERE s.start_time >= ? AND s.start_time < ?
        """;
    Object[] parameters;
    if ("DOCTOR".equals(role) || "DIETITIAN".equals(role)) {
      sql += " AND s.practitioner_id = ?";
      parameters =
          new Object[] {
            date.atStartOfDay(), date.plusDays(1).atStartOfDay(), authentication.getName()
          };
    } else {
      parameters = new Object[] {date.atStartOfDay(), date.plusDays(1).atStartOfDay()};
    }
    sql += " ORDER BY s.start_time";
    return jdbc.query(
        sql,
        (row, ignored) ->
            new SlotView(
                row.getString("id"),
                row.getString("practitioner_id"),
                row.getString("practitioner_name"),
                toDateTime(row.getTimestamp("start_time")),
                row.getInt("duration_minutes"),
                row.getString("status")),
        parameters);
  }

  @PostMapping("/slots")
  @PreAuthorize(
      "hasAnyRole('DOCTOR','DIETITIAN','RECEPTION_STAFF','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR')")
  @ResponseStatus(HttpStatus.CREATED)
  public SlotView createSlot(Authentication authentication, @RequestBody CreateSlotRequest request) {
    String role = roleOf(authentication);
    String practitionerId = request.practitionerId();
    if ("DOCTOR".equals(role) || "DIETITIAN".equals(role)) {
      practitionerId = authentication.getName();
    }
    if (practitionerId == null || practitionerId.isBlank()) {
      throw new IllegalArgumentException("Select a practitioner for the slot");
    }
    LocalDateTime start = requireFutureStart(request.startTime());
    int duration = request.durationMinutes() == null ? 60 : request.durationMinutes();
    validateDuration(duration);
    ensurePractitioner(practitionerId);

    assertNoOverlap(practitionerId, start, duration, null);

    String id = UUID.randomUUID().toString();
    jdbc.update(
        """
        INSERT INTO availability_slots
          (id, practitioner_id, start_time, duration_minutes, status, hold_expires_at, version)
        VALUES (?, ?, ?, ?, 'AVAILABLE', NULL, 0)
        """,
        id,
        practitionerId,
        Timestamp.valueOf(start),
        duration);
    return loadSlot(id);
  }

  @PutMapping("/slots/{id}")
  @PreAuthorize(
      "hasAnyRole('DOCTOR','DIETITIAN','RECEPTION_STAFF','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR')")
  public SlotView updateSlot(
      Authentication authentication,
      @PathVariable String id,
      @RequestBody UpdateSlotRequest request) {
    SlotView existing = loadSlot(id);
    requireSlotManageAccess(authentication, existing.practitionerId());
    if (!"AVAILABLE".equals(existing.status())) {
      throw new IllegalStateException("Only available slots can be edited");
    }
    LocalDateTime start = requireFutureStart(request.startTime());
    int duration =
        request.durationMinutes() == null ? existing.durationMinutes() : request.durationMinutes();
    validateDuration(duration);

    assertNoOverlap(existing.practitionerId(), start, duration, id);

    int updated =
        jdbc.update(
            """
            UPDATE availability_slots
            SET start_time = ?, duration_minutes = ?
            WHERE id = ? AND status = 'AVAILABLE'
            """,
            Timestamp.valueOf(start),
            duration,
            id);
    if (updated == 0) {
      throw new IllegalStateException("Only available slots can be edited");
    }
    return loadSlot(id);
  }

  @DeleteMapping("/slots/{id}")
  @PreAuthorize(
      "hasAnyRole('DOCTOR','DIETITIAN','RECEPTION_STAFF','SYSTEM_ADMIN','MEDICAL_CENTER_COORDINATOR')")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteSlot(Authentication authentication, @PathVariable String id) {
    SlotView existing = loadSlot(id);
    requireSlotManageAccess(authentication, existing.practitionerId());
    if (!"AVAILABLE".equals(existing.status())) {
      throw new IllegalStateException("Only available slots can be removed");
    }
    int deleted =
        jdbc.update("DELETE FROM availability_slots WHERE id = ? AND status = 'AVAILABLE'", id);
    if (deleted == 0) {
      throw new IllegalStateException("Only available slots can be removed");
    }
  }

  @GetMapping("/invoices")
  @PreAuthorize(
      "hasAnyRole('SYSTEM_ADMIN','FINANCE_EXECUTIVE','OPERATIONS_MANAGER','RECEPTION_STAFF','PATIENT')")
  public List<InvoiceView> invoices(Authentication authentication) {
    String role = roleOf(authentication);
    String sql =
        """
        SELECT i.id, i.invoice_number, i.appointment_id, i.amount, i.status, i.created_at,
               a.patient_id, p.full_name patient_name, a.service_type
        FROM invoices i
        JOIN appointments a ON a.id = i.appointment_id
        JOIN user_accounts p ON p.id = a.patient_id
        """;
    Object[] parameters = new Object[0];
    if ("PATIENT".equals(role)) {
      sql += " WHERE a.patient_id = ?";
      parameters = new Object[] {authentication.getName()};
    }
    sql += " ORDER BY i.created_at DESC";
    return jdbc.query(
        sql,
        (row, ignored) ->
            new InvoiceView(
                row.getString("id"),
                row.getString("invoice_number"),
                row.getString("appointment_id"),
                row.getString("patient_id"),
                row.getString("patient_name"),
                row.getString("service_type"),
                row.getBigDecimal("amount"),
                row.getString("status"),
                toDateTime(row.getTimestamp("created_at"))),
        parameters);
  }

  @PostMapping("/invoices")
  @PreAuthorize(
      "hasAnyRole('SYSTEM_ADMIN','FINANCE_EXECUTIVE','OPERATIONS_MANAGER','RECEPTION_STAFF')")
  @ResponseStatus(HttpStatus.CREATED)
  public InvoiceView createInvoice(@RequestBody CreateInvoiceRequest request) {
    if (request.appointmentId() == null || request.appointmentId().isBlank()) {
      throw new IllegalArgumentException("Appointment ID is required");
    }
    if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) < 0) {
      throw new IllegalArgumentException("Valid invoice amount is required");
    }
    // Verify appointment exists
    Integer exists =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM appointments WHERE id = ?", Integer.class, request.appointmentId());
    if (exists == null || exists == 0) {
      throw new IllegalArgumentException("Appointment not found");
    }
    // Check if appointment already has an invoice
    Integer hasInvoice =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM invoices WHERE appointment_id = ?",
            Integer.class,
            request.appointmentId());
    if (hasInvoice != null && hasInvoice > 0) {
      throw new IllegalArgumentException("An invoice already exists for this appointment");
    }
    String id = UUID.randomUUID().toString();
    String number = "INV-" + System.currentTimeMillis();
    String status =
        request.status() == null || request.status().isBlank() ? "PENDING" : request.status();
    jdbc.update(
        """
        INSERT INTO invoices (id, invoice_number, appointment_id, amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        id,
        number,
        request.appointmentId(),
        request.amount(),
        status,
        Timestamp.valueOf(LocalDateTime.now()));
    return loadInvoice(id);
  }

  @PutMapping("/invoices/{id}")
  @PreAuthorize(
      "hasAnyRole('SYSTEM_ADMIN','FINANCE_EXECUTIVE','OPERATIONS_MANAGER','RECEPTION_STAFF')")
  public InvoiceView updateInvoice(
      @PathVariable String id, @RequestBody UpdateInvoiceRequest request) {
    if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) < 0) {
      throw new IllegalArgumentException("Valid invoice amount is required");
    }
    String status =
        request.status() == null || request.status().isBlank() ? "PENDING" : request.status();
    int updated =
        jdbc.update(
            "UPDATE invoices SET amount = ?, status = ? WHERE id = ?",
            request.amount(),
            status,
            id);
    if (updated == 0) {
      throw new IllegalArgumentException("Invoice not found");
    }
    return loadInvoice(id);
  }

  @DeleteMapping("/invoices/{id}")
  @PreAuthorize(
      "hasAnyRole('SYSTEM_ADMIN','FINANCE_EXECUTIVE','OPERATIONS_MANAGER','RECEPTION_STAFF')")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteInvoice(@PathVariable String id) {
    jdbc.update("DELETE FROM payments WHERE invoice_id = ?", id);
    int deleted = jdbc.update("DELETE FROM invoices WHERE id = ?", id);
    if (deleted == 0) {
      throw new IllegalArgumentException("Invoice not found");
    }
  }

  private InvoiceView loadInvoice(String id) {
    List<InvoiceView> rows =
        jdbc.query(
            """
            SELECT i.id, i.invoice_number, i.appointment_id, i.amount, i.status, i.created_at,
                   a.patient_id, p.full_name patient_name, a.service_type
            FROM invoices i
            JOIN appointments a ON a.id = i.appointment_id
            JOIN user_accounts p ON p.id = a.patient_id
            WHERE i.id = ?
            """,
            (row, ignored) ->
                new InvoiceView(
                    row.getString("id"),
                    row.getString("invoice_number"),
                    row.getString("appointment_id"),
                    row.getString("patient_id"),
                    row.getString("patient_name"),
                    row.getString("service_type"),
                    row.getBigDecimal("amount"),
                    row.getString("status"),
                    toDateTime(row.getTimestamp("created_at"))),
            id);
    if (rows.isEmpty()) {
      throw new IllegalArgumentException("Invoice not found");
    }
    return rows.get(0);
  }

  @GetMapping("/summary")
  public Map<String, Object> summary(Principal principal, Authentication authentication) {
    List<AppointmentView> visibleAppointments = appointments(authentication);
    long confirmed =
        visibleAppointments.stream().filter(item -> "CONFIRMED".equals(item.status())).count();
    BigDecimal outstanding =
        visibleAppointments.stream()
            .filter(item -> item.invoiceStatus() != null && !"PAID".equals(item.invoiceStatus()))
            .map(AppointmentView::amount)
            .filter(amount -> amount != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    return Map.of(
        "accountId",
        principal.getName(),
        "appointments",
        visibleAppointments.size(),
        "confirmed",
        confirmed,
        "outstanding",
        outstanding);
  }

  private SlotView loadSlot(String id) {
    List<SlotView> rows =
        jdbc.query(
            """
            SELECT s.id, s.practitioner_id, u.full_name practitioner_name,
                   s.start_time, s.duration_minutes, s.status
            FROM availability_slots s
            JOIN user_accounts u ON u.id = s.practitioner_id
            WHERE s.id = ?
            """,
            (row, ignored) ->
                new SlotView(
                    row.getString("id"),
                    row.getString("practitioner_id"),
                    row.getString("practitioner_name"),
                    toDateTime(row.getTimestamp("start_time")),
                    row.getInt("duration_minutes"),
                    row.getString("status")),
            id);
    if (rows.isEmpty()) {
      throw new IllegalArgumentException("Slot not found");
    }
    return rows.get(0);
  }


  private void assertNoOverlap(
      String practitionerId, LocalDateTime start, int durationMinutes, String excludeId) {
    LocalDateTime end = start.plusMinutes(durationMinutes);
    Integer conflict;
    if (excludeId == null || excludeId.isBlank()) {
      conflict =
          jdbc.queryForObject(
              """
              SELECT COUNT(*) FROM availability_slots
              WHERE practitioner_id = ?
                AND start_time < ?
                AND DATE_ADD(start_time, INTERVAL duration_minutes MINUTE) > ?
              """,
              Integer.class,
              practitionerId,
              Timestamp.valueOf(end),
              Timestamp.valueOf(start));
    } else {
      conflict =
          jdbc.queryForObject(
              """
              SELECT COUNT(*) FROM availability_slots
              WHERE practitioner_id = ?
                AND id <> ?
                AND start_time < ?
                AND DATE_ADD(start_time, INTERVAL duration_minutes MINUTE) > ?
              """,
              Integer.class,
              practitionerId,
              excludeId,
              Timestamp.valueOf(end),
              Timestamp.valueOf(start));
    }
    if (conflict != null && conflict > 0) {
      throw new IllegalArgumentException(
          "This time overlaps another open slot for this practitioner. Pick a start time after the existing slot ends.");
    }
  }
  private void ensurePractitioner(String practitionerId) {
    Integer count =
        jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM user_accounts
            WHERE id = ? AND enabled = TRUE AND role IN ('DOCTOR','DIETITIAN')
            """,
            Integer.class,
            practitionerId);
    if (count == null || count == 0) {
      throw new IllegalArgumentException("Practitioner account was not found");
    }
  }

  private void requireSlotManageAccess(Authentication authentication, String practitionerId) {
    String role = roleOf(authentication);
    if (("DOCTOR".equals(role) || "DIETITIAN".equals(role))
        && !authentication.getName().equals(practitionerId)) {
      throw new AccessDeniedException("You can only manage your own availability");
    }
  }

  private LocalDateTime requireFutureStart(LocalDateTime start) {
    if (start == null) {
      throw new IllegalArgumentException("Start time is required");
    }
    if (start.isBefore(LocalDateTime.now().minusMinutes(1))) {
      throw new IllegalArgumentException("Slot start time must be in the future");
    }
    return start;
  }

  private void validateDuration(int durationMinutes) {
    if (durationMinutes < 15 || durationMinutes > 240) {
      throw new IllegalArgumentException("Duration must be between 15 and 240 minutes");
    }
  }

  private String roleOf(Authentication authentication) {
    return authentication.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");
  }

  private LocalDateTime toDateTime(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toLocalDateTime();
  }

  public record PersonView(String id, String fullName, String role, boolean enabled) {}

  public record AppointmentView(
      String id,
      String patientId,
      String patientName,
      String practitionerId,
      String practitionerName,
      String serviceType,
      String status,
      LocalDateTime startTime,
      String invoiceNumber,
      BigDecimal amount,
      String invoiceStatus) {}

  public record SlotView(
      String id,
      String practitionerId,
      String practitionerName,
      LocalDateTime startTime,
      int durationMinutes,
      String status) {}

  public record CreateSlotRequest(
      String practitionerId, LocalDateTime startTime, Integer durationMinutes) {}

  public record UpdateSlotRequest(LocalDateTime startTime, Integer durationMinutes) {}

  public record InvoiceView(
      String id,
      String invoiceNumber,
      String appointmentId,
      String patientId,
      String patientName,
      String serviceType,
      BigDecimal amount,
      String status,
      LocalDateTime createdAt) {}

  public record CreateInvoiceRequest(
      String appointmentId,
      BigDecimal amount,
      String status) {}

  public record UpdateInvoiceRequest(
      BigDecimal amount,
      String status) {}
}
