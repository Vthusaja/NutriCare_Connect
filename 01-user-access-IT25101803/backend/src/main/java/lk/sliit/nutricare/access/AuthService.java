package lk.sliit.nutricare.access;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  public static final Set<String> ROLES =
      Set.of(
          "PATIENT",
          "DIETITIAN",
          "DOCTOR",
          "RECEPTION_STAFF",
          "SYSTEM_ADMIN",
          "OPERATIONS_MANAGER",
          "FINANCE_EXECUTIVE",
          "MEDICAL_CENTER_COORDINATOR",
          "PATIENT_RELATIONS_OFFICER");

  private final UserRepository users;
  private final PasswordEncoder passwords;
  private final TokenService tokens;
  private final AuditEventRepository audit;
  private final PasswordResetOtpRepository resetOtps;
  private final AccountMailer emails;
  private final AccountIdService accountIds;
  private final boolean exposeDemoOtp;
  private final org.springframework.jdbc.core.JdbcTemplate jdbc;
  private final SecureRandom random = new SecureRandom();

  public AuthService(
      UserRepository users,
      PasswordEncoder passwords,
      TokenService tokens,
      AuditEventRepository audit,
      PasswordResetOtpRepository resetOtps,
      AccountMailer emails,
      AccountIdService accountIds,
      @Value("${nutricare.demo-notifications:true}") boolean exposeDemoOtp,
      org.springframework.beans.factory.ObjectProvider<org.springframework.jdbc.core.JdbcTemplate> jdbcProvider) {
    this.users = users;
    this.passwords = passwords;
    this.tokens = tokens;
    this.audit = audit;
    this.resetOtps = resetOtps;
    this.emails = emails;
    this.accountIds = accountIds;
    this.exposeDemoOtp = exposeDemoOtp;
    this.jdbc = jdbcProvider.getIfAvailable();
  }

  @Transactional
  public UserAccount register(
      String name, String email, String password, String phone, LocalDate dateOfBirth) {
    if (users.findByEmailIgnoreCase(email).isPresent())
      throw new IllegalArgumentException("Email already registered");
    UserAccount user =
        users.save(
            new UserAccount(
                accountIds.nextId("PATIENT"), name, email, passwords.encode(password), "PATIENT"));
    user.updateProfile(name, email, phone, dateOfBirth, null);
    users.save(user);
    audit.save(new AuditEvent(user.getId(), "REGISTER", "USER", user.getId().toString()));
    return user;
  }

  @Transactional(noRollbackFor = IllegalArgumentException.class)
  public String login(String email, String password) {
    UserAccount user =
        users
            .findByEmailIgnoreCase(email)
            .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
    if (!user.isEnabled())
      throw new IllegalStateException("Account is disabled. Contact an administrator.");
    if (user.isLocked())
      throw new IllegalStateException("Account locked after five failed attempts");
    if (!passwords.matches(password, user.getPasswordHash())) {
      user.failedLogin();
      users.save(user);
      throw new IllegalArgumentException(
          user.isLocked() ? "Account locked after five failed attempts" : "Invalid credentials");
    }
    user.successfulLogin();
    users.save(user);
    audit.save(new AuditEvent(user.getId(), "LOGIN", "USER", user.getId().toString()));
    return tokens.issue(user);
  }

  @Transactional
  public UserAccount updateProfile(
      String userId,
      String name,
      String email,
      String phone,
      LocalDate dateOfBirth,
      String address) {
    UserAccount user = users.findById(userId).orElseThrow();
    if (users.existsByEmailIgnoreCaseAndIdNot(email, userId))
      throw new IllegalArgumentException("Email already registered");
    user.updateProfile(name, email, phone, dateOfBirth, address);
    audit.save(new AuditEvent(userId, "UPDATE_PROFILE", "USER", userId.toString()));
    return users.save(user);
  }

  @Transactional
  public UserAccount setAccountStatus(String actorId, String userId, boolean enabled) {
    if (actorId.equals(userId) && !enabled)
      throw new IllegalArgumentException("Administrators cannot disable their own account");
    UserAccount user = users.findById(userId).orElseThrow();
    user.setEnabled(enabled);
    audit.save(
        new AuditEvent(
            actorId, enabled ? "ENABLE_USER" : "DISABLE_USER", "USER", userId.toString()));
    return users.save(user);
  }

  @Transactional
  public void deleteUser(String actorId, String userId) {
    if (actorId.equals(userId)) {
      throw new IllegalArgumentException("Administrators cannot delete their own account");
    }
    UserAccount user =
        users
            .findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User account not found"));

    if (jdbc != null) {
      // 1. Password reset OTPs
      jdbc.update("DELETE FROM password_reset_otps WHERE user_id = ?", userId);

      // 2. Health alerts and checkups
      jdbc.update(
          "DELETE FROM health_alerts WHERE patient_id = ? OR health_check_id IN (SELECT id FROM health_checks WHERE patient_id = ? OR practitioner_id = ?)",
          userId,
          userId,
          userId);
      jdbc.update(
          "DELETE FROM health_checks WHERE patient_id = ? OR practitioner_id = ?", userId, userId);

      // 3. Progress logs and diet plans
      jdbc.update(
          "DELETE FROM progress_logs WHERE patient_id = ? OR diet_plan_id IN (SELECT id FROM diet_plans WHERE patient_id = ? OR dietitian_id = ?)",
          userId,
          userId,
          userId);
      jdbc.update(
          "DELETE FROM diet_plans WHERE patient_id = ? OR dietitian_id = ?", userId, userId);

      // 4. Messages and notifications
      jdbc.update(
          "DELETE FROM secure_messages WHERE sender_id = ? OR recipient_id = ? OR patient_id = ?",
          userId,
          userId,
          userId);
      jdbc.update("DELETE FROM notifications WHERE recipient_id = ?", userId);

      // 5. Complaints and feedback
      jdbc.update(
          "DELETE FROM complaints WHERE feedback_id IN (SELECT id FROM feedback WHERE patient_id = ? OR practitioner_id = ?)",
          userId,
          userId);
      jdbc.update("DELETE FROM feedback WHERE patient_id = ? OR practitioner_id = ?", userId, userId);

      // 6. Payments, invoices, appointments, availability slots
      jdbc.update(
          "DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE appointment_id IN (SELECT id FROM appointments WHERE patient_id = ? OR practitioner_id = ?))",
          userId,
          userId);
      jdbc.update(
          "DELETE FROM invoices WHERE appointment_id IN (SELECT id FROM appointments WHERE patient_id = ? OR practitioner_id = ?)",
          userId,
          userId);
      jdbc.update(
          "DELETE FROM appointments WHERE patient_id = ? OR practitioner_id = ?", userId, userId);
      jdbc.update("DELETE FROM availability_slots WHERE practitioner_id = ?", userId);

      // 7. Audit events
      jdbc.update("DELETE FROM audit_events WHERE actor_id = ?", userId);
    }

    users.delete(user);
    audit.save(new AuditEvent(actorId, "DELETE_USER", "USER", userId));
  }

  @Transactional
  public UserAccount setRole(String actorId, String userId, String role) {
    String normalized = role.toUpperCase(Locale.ROOT);
    if (!ROLES.contains(normalized)) throw new IllegalArgumentException("Unknown role");
    UserAccount user = users.findById(userId).orElseThrow();
    user.setRole(normalized);
    audit.save(new AuditEvent(actorId, "CHANGE_ROLE", "USER", userId.toString()));
    return users.save(user);
  }

  @Transactional
  public void logout(String userId) {
    audit.save(new AuditEvent(userId, "LOGOUT", "USER", userId.toString()));
  }

  @Transactional
  public ProvisionedAccount provisionStaff(String actorId, String name, String email, String role) {
    String normalized = role.toUpperCase(Locale.ROOT);
    if (!ROLES.contains(normalized) || "PATIENT".equals(normalized))
      throw new IllegalArgumentException("Select a staff role");
    if (users.findByEmailIgnoreCase(email).isPresent())
      throw new IllegalArgumentException("Email already registered");
    String temporaryPassword = temporaryPassword();
    UserAccount user =
        new UserAccount(
            accountIds.nextId(normalized),
            name,
            email,
            passwords.encode(temporaryPassword),
            normalized);
    user.requirePasswordChange();
    users.save(user);
    emails.sendStaffWelcome(user.getEmail());
    audit.save(new AuditEvent(actorId, "PROVISION_STAFF", "USER", user.getId().toString()));
    return new ProvisionedAccount(user, temporaryPassword);
  }

  @Transactional
  public UserAccount changePassword(String userId, String currentPassword, String newPassword) {
    UserAccount user = users.findById(userId).orElseThrow();
    if (!passwords.matches(currentPassword, user.getPasswordHash()))
      throw new IllegalArgumentException("Current password is incorrect");
    if (passwords.matches(newPassword, user.getPasswordHash()))
      throw new IllegalArgumentException("Choose a different password");
    user.changePassword(passwords.encode(newPassword));
    audit.save(new AuditEvent(userId, "CHANGE_PASSWORD", "USER", userId.toString()));
    return users.save(user);
  }

  @Transactional
  public ForgotPasswordResult requestPasswordReset(String email) {
    UserAccount user = users.findByEmailIgnoreCase(email).orElse(null);
    if (user == null || !user.isEnabled()) return new ForgotPasswordResult(null);
    resetOtps
        .findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(user.getId())
        .ifPresent(
            existing -> {
              existing.consume();
              resetOtps.save(existing);
            });
    String otp = String.format("%06d", random.nextInt(1_000_000));
    resetOtps.save(new PasswordResetOtp(user.getId(), passwords.encode(otp)));
    emails.sendPasswordResetOtp(user.getEmail(), otp);
    audit.save(
        new AuditEvent(user.getId(), "REQUEST_PASSWORD_RESET", "USER", user.getId().toString()));
    return new ForgotPasswordResult(exposeDemoOtp ? otp : null);
  }

  @Transactional(noRollbackFor = IllegalArgumentException.class)
  public void resetPassword(String email, String otp, String newPassword) {
    UserAccount user =
        users
            .findByEmailIgnoreCase(email)
            .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset code"));
    PasswordResetOtp reset =
        resetOtps
            .findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(user.getId())
            .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset code"));
    if (reset.getExpiresAt().isBefore(Instant.now()) || reset.getAttempts() >= 5) {
      reset.consume();
      resetOtps.save(reset);
      throw new IllegalArgumentException("Invalid or expired reset code");
    }
    if (!passwords.matches(otp, reset.getOtpHash())) {
      reset.failedAttempt();
      if (reset.getAttempts() >= 5) reset.consume();
      resetOtps.save(reset);
      throw new IllegalArgumentException("Invalid or expired reset code");
    }
    reset.consume();
    user.changePassword(passwords.encode(newPassword));
    resetOtps.save(reset);
    users.save(user);
    audit.save(new AuditEvent(user.getId(), "RESET_PASSWORD", "USER", user.getId().toString()));
  }

  private String temporaryPassword() {
    String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    StringBuilder password = new StringBuilder("Nc!");
    for (int index = 0; index < 9; index++)
      password.append(alphabet.charAt(random.nextInt(alphabet.length())));
    return password.toString();
  }

  public record ProvisionedAccount(UserAccount user, String temporaryPassword) {}

  public record ForgotPasswordResult(String demoOtp) {}
}
