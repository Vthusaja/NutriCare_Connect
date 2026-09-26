package lk.sliit.nutricare.access;

import java.time.Instant;
import java.util.UUID;

public record AuditEventResponse(
    UUID id,
    String actorId,
    String operation,
    String entityType,
    String entityId,
    Instant occurredAt) {
  public static AuditEventResponse of(AuditEvent event) {
    return new AuditEventResponse(
        event.getId(),
        event.getActorId(),
        event.getOperation(),
        event.getEntityType(),
        event.getEntityId(),
        event.getOccurredAt());
  }
}
