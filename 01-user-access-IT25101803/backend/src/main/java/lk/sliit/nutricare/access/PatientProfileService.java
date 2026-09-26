package lk.sliit.nutricare.access;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PatientProfileService {
  private final PatientMedicalProfileRepository profiles;

  public PatientProfileService(PatientMedicalProfileRepository profiles) {
    this.profiles = profiles;
  }

  public PatientMedicalProfile getOrCreateProfile(String userId) {
    return profiles
        .findByUserAccountId(userId)
        .orElseGet(() -> profiles.save(new PatientMedicalProfile(userId)));
  }

  public PatientProfileResponse getProfile(String userId) {
    PatientMedicalProfile profile = getOrCreateProfile(userId);
    return PatientProfileResponse.of(profile);
  }

  public PatientProfileResponse updateProfile(String userId, PatientProfileRequest request) {
    PatientMedicalProfile profile = getOrCreateProfile(userId);
    profile.setBloodGroup(request.bloodGroup());
    profile.setAllergies(request.allergies());
    profile.setChronicConditions(request.chronicConditions());
    profile.setEmergencyContactName(request.emergencyContactName());
    profile.setEmergencyContactRelation(request.emergencyContactRelation());
    profile.setEmergencyContactPhone(request.emergencyContactPhone());
    return PatientProfileResponse.of(profiles.save(profile));
  }
}
