package lk.sliit.nutricare.appointment;

import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {
  private final AppointmentService service;

  public BillingController(AppointmentService service) {
    this.service = service;
  }

  @GetMapping("/invoices/{id}")
  @PreAuthorize("hasAnyRole('PATIENT','RECEPTION_STAFF','FINANCE_EXECUTIVE','SYSTEM_ADMIN')")
  public Invoice getInvoice(@PathVariable UUID id) {
    return service.requireInvoice(id);
  }

  @PutMapping("/invoices/{id}")
  @PreAuthorize("hasAnyRole('RECEPTION_STAFF','FINANCE_EXECUTIVE','SYSTEM_ADMIN')")
  public Invoice updateInvoice(@PathVariable UUID id, @RequestBody UpdateInvoiceRequest request) {
    return service.updateInvoice(id, request.status());
  }

  public record UpdateInvoiceRequest(String status) {}
}
