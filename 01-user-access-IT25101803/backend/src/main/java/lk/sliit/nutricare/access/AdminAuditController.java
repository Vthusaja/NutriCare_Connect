package lk.sliit.nutricare.access;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminAuditController {
  private final AuditService audits;

  public AdminAuditController(AuditService audits) {
    this.audits = audits;
  }

  @GetMapping("/audit-logs")
  @PreAuthorize("hasRole('SYSTEM_ADMIN')")
  public Page<AuditEventResponse> logs(Pageable pageable) {
    return audits.getAuditLogs(pageable);
  }
}
