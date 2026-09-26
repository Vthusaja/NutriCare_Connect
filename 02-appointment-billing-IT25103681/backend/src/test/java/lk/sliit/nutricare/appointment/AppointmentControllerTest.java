package lk.sliit.nutricare.appointment;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AppointmentController.class)
class AppointmentControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockBean private AppointmentService service;
  @MockBean private SlotRepository slots;
  @MockBean private AppointmentRepository appointments;

  @Test
  @WithMockUser(username = "pat1", roles = "PATIENT")
  void testGetAppointment() throws Exception {
    UUID id = UUID.randomUUID();
    Appointment mockAppt = new Appointment(new AvailabilitySlot("doc1", LocalDateTime.now(), 60), "pat1", "General");
    when(service.requireAppointment(id)).thenReturn(mockAppt);

    mockMvc.perform(get("/api/v1/appointments/" + id))
        .andExpect(status().isOk());
  }

  @Test
  @WithMockUser(roles = "RECEPTION_STAFF")
  void testGetAllAppointments() throws Exception {
    when(service.getAllAppointments()).thenReturn(List.of());

    mockMvc.perform(get("/api/v1/appointments"))
        .andExpect(status().isOk());
  }

  @Test
  @WithMockUser(username = "pat1", roles = "PATIENT")
  void testRescheduleAppointment() throws Exception {
    UUID id = UUID.randomUUID();
    UUID newSlotId = UUID.randomUUID();
    Appointment mockAppt = new Appointment(new AvailabilitySlot("doc1", LocalDateTime.now(), 60), "pat1", "General");
    when(service.requireAppointment(id)).thenReturn(mockAppt);
    when(service.reschedule(eq(id), eq(newSlotId))).thenReturn(mockAppt);

    mockMvc.perform(put("/api/v1/appointments/" + id)
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"newSlotId\":\"" + newSlotId + "\"}"))
        .andExpect(status().isOk());
  }

  @Test
  @WithMockUser(username = "pat1", roles = "PATIENT")
  void testDeleteAppointment() throws Exception {
    UUID id = UUID.randomUUID();
    Appointment mockAppt = new Appointment(new AvailabilitySlot("doc1", LocalDateTime.now(), 60), "pat1", "General");
    when(service.requireAppointment(id)).thenReturn(mockAppt);

    mockMvc.perform(delete("/api/v1/appointments/" + id).with(csrf()))
        .andExpect(status().isNoContent());

    verify(service).cancel(id);
  }
}
