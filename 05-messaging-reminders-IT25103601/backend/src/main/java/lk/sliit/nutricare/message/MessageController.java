package lk.sliit.nutricare.message;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class MessageController {
  private final MessageRepository messages;
  private final NotificationRepository notifications;

  MessageController(MessageRepository messages, NotificationRepository notifications) {
    this.messages = messages;
    this.notifications = notifications;
  }

  @PostMapping("/messages")
  @PreAuthorize(
      "hasAnyRole('DIETITIAN','DOCTOR','RECEPTION_STAFF','PATIENT_RELATIONS_OFFICER','SYSTEM_ADMIN')"
          + " or (hasRole('PATIENT') and principal == #request.senderId.toString() and principal =="
          + " #request.patientId.toString())")
  @ResponseStatus(HttpStatus.CREATED)
  SecureMessage send(@Valid @RequestBody MessageRequest request) {
    return messages.save(
        new SecureMessage(
            request.senderId(), request.recipientId(), request.patientId(), request.body()));
  }

  @GetMapping("/messages/patient/{id}")
  @PreAuthorize(
      "hasAnyRole('DIETITIAN','DOCTOR','RECEPTION_STAFF','PATIENT_RELATIONS_OFFICER','SYSTEM_ADMIN')"
          + " or (hasRole('PATIENT') and principal == #id.toString())")
  List<SecureMessage> conversation(@PathVariable String id) {
    return messages.findByPatientIdOrderBySentAtAsc(id);
  }

  @PutMapping("/messages/{id}")
  @PreAuthorize(
      "hasAnyRole('DIETITIAN','DOCTOR','RECEPTION_STAFF','PATIENT_RELATIONS_OFFICER','SYSTEM_ADMIN','PATIENT')")
  SecureMessage update(
      org.springframework.security.core.Authentication authentication,
      @PathVariable java.util.UUID id,
      @Valid @RequestBody UpdateMessageRequest request) {
    SecureMessage message =
        messages
            .findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Message not found"));
    requireMessageManageAccess(authentication, message);
    if (Instant.now().isAfter(message.getSentAt().plus(10, java.time.temporal.ChronoUnit.MINUTES))) {
      throw new IllegalArgumentException(
          "Messages can only be edited within 10 minutes of sending");
    }
    message.setBody(request.body());
    return messages.save(message);
  }

  @DeleteMapping("/messages/{id}")
  @PreAuthorize(
      "hasAnyRole('DIETITIAN','DOCTOR','RECEPTION_STAFF','PATIENT_RELATIONS_OFFICER','SYSTEM_ADMIN','PATIENT')")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(
      org.springframework.security.core.Authentication authentication,
      @PathVariable java.util.UUID id) {
    SecureMessage message =
        messages
            .findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Message not found"));
    requireMessageManageAccess(authentication, message);
    if (Instant.now().isAfter(message.getSentAt().plus(10, java.time.temporal.ChronoUnit.MINUTES))) {
      throw new IllegalArgumentException(
          "Messages can only be deleted within 10 minutes of sending");
    }
    messages.delete(message);
  }

  private void requireMessageManageAccess(
      org.springframework.security.core.Authentication authentication, SecureMessage message) {
    String role =
        authentication.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");
    if (!"SYSTEM_ADMIN".equals(role) && !authentication.getName().equals(message.getSenderId())) {
      throw new org.springframework.security.access.AccessDeniedException(
          "You can only edit or delete your own messages");
    }
  }

  @PostMapping("/notifications")
  @PreAuthorize(
      "hasAnyRole('DIETITIAN','DOCTOR','RECEPTION_STAFF','SYSTEM_ADMIN','PATIENT_RELATIONS_OFFICER')")
  @ResponseStatus(HttpStatus.CREATED)
  Notification notify(@Valid @RequestBody NoticeRequest request) {
    return notifications.save(
        new Notification(
            request.recipientId(),
            request.type(),
            request.channel(),
            request.message(),
            request.simulateFailure() ? "FAILED" : "DELIVERED_SIMULATED"));
  }

  @GetMapping("/notifications/recipient/{id}")
  @PreAuthorize(
      "hasAnyRole('SYSTEM_ADMIN','DIETITIAN','DOCTOR','RECEPTION_STAFF','PATIENT_RELATIONS_OFFICER')"
          + " or principal == #id.toString()")
  List<Notification> notices(@PathVariable String id) {
    return notifications.findByRecipientIdOrderByCreatedAtDesc(id);
  }

  @Scheduled(fixedDelay = 60000)
  @Transactional
  public void retry() {
    notifications
        .findByStatusAndRetryAtBefore("FAILED", Instant.now())
        .forEach(Notification::retry);
  }

  record MessageRequest(
      @NotNull String senderId,
      @NotNull String recipientId,
      @NotNull String patientId,
      @NotBlank @Size(max = 2000) String body) {}

  record UpdateMessageRequest(@NotBlank @Size(max = 2000) String body) {}

  record NoticeRequest(
      @NotNull String recipientId,
      @NotBlank String type,
      @Pattern(regexp = "IN_APP|EMAIL|SMS") String channel,
      @NotBlank String message,
      boolean simulateFailure) {}
}
