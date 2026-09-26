package lk.sliit.nutricare.access;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "patient_medical_profiles")
public class PatientMedicalProfile {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_account_id", nullable = false, unique = true, length = 16)
  private String userAccountId;

  @Column(name = "blood_group", length = 10)
  private String bloodGroup;

  @Column(columnDefinition = "TEXT")
  private String allergies;

  @Column(name = "chronic_conditions", columnDefinition = "TEXT")
  private String chronicConditions;

  @Column(name = "emergency_contact_name", length = 100)
  private String emergencyContactName;

  @Column(name = "emergency_contact_relation", length = 50)
  private String emergencyContactRelation;

  @Column(name = "emergency_contact_phone", length = 20)
  private String emergencyContactPhone;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected PatientMedicalProfile() {}

  public PatientMedicalProfile(String userAccountId) {
    this.userAccountId = userAccountId;
    this.createdAt = Instant.now();
    this.updatedAt = this.createdAt;
  }

  public Long getId() {
    return id;
  }

  public String getUserAccountId() {
    return userAccountId;
  }

  public String getBloodGroup() {
    return bloodGroup;
  }

  public void setBloodGroup(String bloodGroup) {
    this.bloodGroup = bloodGroup;
    this.updatedAt = Instant.now();
  }

  public String getAllergies() {
    return allergies;
  }

  public void setAllergies(String allergies) {
    this.allergies = allergies;
    this.updatedAt = Instant.now();
  }

  public String getChronicConditions() {
    return chronicConditions;
  }

  public void setChronicConditions(String chronicConditions) {
    this.chronicConditions = chronicConditions;
    this.updatedAt = Instant.now();
  }

  public String getEmergencyContactName() {
    return emergencyContactName;
  }

  public void setEmergencyContactName(String emergencyContactName) {
    this.emergencyContactName = emergencyContactName;
    this.updatedAt = Instant.now();
  }

  public String getEmergencyContactRelation() {
    return emergencyContactRelation;
  }

  public void setEmergencyContactRelation(String emergencyContactRelation) {
    this.emergencyContactRelation = emergencyContactRelation;
    this.updatedAt = Instant.now();
  }

  public String getEmergencyContactPhone() {
    return emergencyContactPhone;
  }

  public void setEmergencyContactPhone(String emergencyContactPhone) {
    this.emergencyContactPhone = emergencyContactPhone;
    this.updatedAt = Instant.now();
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
