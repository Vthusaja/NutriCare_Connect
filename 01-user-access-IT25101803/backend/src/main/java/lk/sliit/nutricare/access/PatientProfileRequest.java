package lk.sliit.nutricare.access;

import jakarta.validation.constraints.Size;

public record PatientProfileRequest(
    @Size(max = 10) String bloodGroup,
    String allergies,
    String chronicConditions,
    @Size(max = 100) String emergencyContactName,
    @Size(max = 50) String emergencyContactRelation,
    @Size(max = 20) String emergencyContactPhone) {}
