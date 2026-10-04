package lk.sliit.nutricare.appointment;

import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

interface SlotRepository extends JpaRepository<AvailabilitySlot, UUID> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from AvailabilitySlot s where s.id=:id")
  Optional<AvailabilitySlot> findForUpdate(@Param("id") UUID id);

  List<AvailabilitySlot> findByStartTimeBetweenOrderByStartTime(
      LocalDateTime from, LocalDateTime to);

  List<AvailabilitySlot> findByStatusAndHoldExpiresAtBefore(String status, Instant now);
  @Query(
      value =
          """
          SELECT COUNT(*) FROM availability_slots
          WHERE practitioner_id = :practitionerId
            AND (:excludeId IS NULL OR id <> :excludeId)
            AND start_time < :newEnd
            AND DATE_ADD(start_time, INTERVAL duration_minutes MINUTE) > :newStart
          """,
      nativeQuery = true)
  long countOverlapping(
      @Param("practitionerId") String practitionerId,
      @Param("newStart") LocalDateTime newStart,
      @Param("newEnd") LocalDateTime newEnd,
      @Param("excludeId") UUID excludeId);
}

interface AppointmentRepository extends JpaRepository<Appointment, UUID> {
  List<Appointment> findByPatientId(String patientId);

  List<Appointment> findByPractitionerId(String practitionerId);

  Optional<Appointment> findBySlotId(UUID slotId);

  List<Appointment> findBySlotIdAndStatus(UUID slotId, String status);
}

interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
  Optional<Invoice> findByAppointmentId(UUID appointmentId);

  void deleteByAppointmentId(UUID appointmentId);
}

interface PaymentRepository extends JpaRepository<Payment, UUID> {
  List<Payment> findByInvoiceId(UUID invoiceId);

  void deleteByInvoiceId(UUID invoiceId);
}

