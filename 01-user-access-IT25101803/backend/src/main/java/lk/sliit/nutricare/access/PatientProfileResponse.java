package lk.sliit.nutricare.access;

public record PatientProfileResponse(
    Long id,
    String bloodGroup,
    String allergies,
    String chronicConditions,
    String emergencyContactName,
    String emergencyContactRelation,
    String emergencyContactPhone) {
  public static PatientProfileResponse of(PatientMedicalProfile profile) {
    return new PatientProfileResponse(
        profile.getId(),
        profile.getBloodGroup(),
        profile.getAllergies(),
        profile.getChronicConditions(),
        profile.getEmergencyContactName(),
        profile.getEmergencyContactRelation(),
        profile.getEmergencyContactPhone());
  }
}
