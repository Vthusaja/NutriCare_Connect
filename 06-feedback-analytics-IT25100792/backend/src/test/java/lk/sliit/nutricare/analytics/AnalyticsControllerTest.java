package lk.sliit.nutricare.analytics;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AnalyticsController.class)
class AnalyticsControllerTest {

  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper mapper;

  @MockBean private FeedbackRepository feedback;
  @MockBean private ComplaintRepository complaints;
  @MockBean private JdbcTemplate jdbc;

  @Test
  @WithMockUser(roles = "PATIENT", username = "P001")
  void getFeedback_ownedByPatient() throws Exception {
    var id = UUID.randomUUID();
    var f = new Feedback("P001", "D001", UUID.randomUUID(), 4, "Good");
    when(feedback.findById(id)).thenReturn(Optional.of(f));

    mvc.perform(get("/api/v1/feedback/{id}", id))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rating").value(4));
  }

  @Test
  @WithMockUser(roles = "PATIENT", username = "P002")
  void getFeedback_notOwnedByPatient_forbidden() throws Exception {
    var id = UUID.randomUUID();
    var f = new Feedback("P001", "D001", UUID.randomUUID(), 4, "Good");
    when(feedback.findById(id)).thenReturn(Optional.of(f));

    mvc.perform(get("/api/v1/feedback/{id}", id))
        .andExpect(status().isForbidden());
  }

  @Test
  @WithMockUser(roles = "SYSTEM_ADMIN")
  void getFeedback_byAdmin() throws Exception {
    var id = UUID.randomUUID();
    var f = new Feedback("P001", "D001", UUID.randomUUID(), 4, "Good");
    when(feedback.findById(id)).thenReturn(Optional.of(f));

    mvc.perform(get("/api/v1/feedback/{id}", id))
        .andExpect(status().isOk());
  }

  @Test
  @WithMockUser(roles = "OPERATIONS_MANAGER")
  void updateComplaint() throws Exception {
    var id = UUID.randomUUID();
    var c = new Complaint(UUID.randomUUID());
    when(complaints.findById(id)).thenReturn(Optional.of(c));
    when(complaints.save(any(Complaint.class))).thenAnswer(invocation -> invocation.getArgument(0));

    var req = new AnalyticsController.ComplaintUpdateRequest("RESOLVED", "HIGH");

    mvc.perform(put("/api/v1/complaints/{id}", id)
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(req)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("RESOLVED"))
        .andExpect(jsonPath("$.priority").value("HIGH"));
  }
}
