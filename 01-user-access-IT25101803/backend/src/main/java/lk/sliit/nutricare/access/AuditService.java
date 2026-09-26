package lk.sliit.nutricare.access;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
  private final AuditEventRepository audits;

  public AuditService(AuditEventRepository audits) {
    this.audits = audits;
  }

  public Page<AuditEventResponse> getAuditLogs(Pageable pageable) {
    return audits.findAll(pageable).map(AuditEventResponse::of);
  }
}
