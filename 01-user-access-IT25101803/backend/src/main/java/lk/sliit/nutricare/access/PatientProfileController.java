package lk.sliit.nutricare.access;

import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class PatientProfileController {
  private final PatientProfileService profiles;

  public PatientProfileController(PatientProfileService profiles) {
    this.profiles = profiles;
  }

  @GetMapping("/patient/profile/me")
  @PreAuthorize("hasRole('PATIENT')")
  public PatientProfileResponse myProfile(Principal principal) {
    return profiles.getProfile(principal.getName());
  }

  @PutMapping("/patient/profile/me")
  @PreAuthorize("hasAnyRole('PATIENT', 'RECEPTION_STAFF', 'MEDICAL_CENTER_COORDINATOR')")
  public PatientProfileResponse updateMyProfile(
      Principal principal, @Valid @RequestBody PatientProfileRequest request) {
    return profiles.updateProfile(principal.getName(), request);
  }

  @GetMapping("/clinical/patients/{userId}/profile")
  @PreAuthorize("hasAnyRole('DOCTOR', 'DIETITIAN', 'SYSTEM_ADMIN')")
  public PatientProfileResponse clinicalProfile(@PathVariable String userId) {
    return profiles.getProfile(userId);
  }
}
