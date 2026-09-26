package lk.sliit.nutricare.health;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
public class HealthControllerTest {

  private MockMvc mockMvc;

  private ObjectMapper objectMapper = new ObjectMapper();

  @Mock private HealthCheckRepository healthCheckRepository;

  @Mock private HealthAlertRepository healthAlertRepository;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.standaloneSetup(new HealthController(healthCheckRepository, healthAlertRepository)).build();
  }

  @Test
  void testGetCheckup() throws Exception {
    UUID id = UUID.randomUUID();
    HealthCheck check = new HealthCheck("PAT123", "DOC123", new BigDecimal("70.5"), new BigDecimal("22.5"), 120, 80, new BigDecimal("100"), new BigDecimal("36.5"), "Normal");
    
    // Use reflection to set ID since it's generated
    java.lang.reflect.Field idField = HealthCheck.class.getDeclaredField("id");
    idField.setAccessible(true);
    idField.set(check, id);

    when(healthCheckRepository.findById(id)).thenReturn(Optional.of(check));

    mockMvc
        .perform(get("/api/v1/checkups/{id}", id))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.patientId").value("PAT123"));
  }

  @Test
  void testUpdateCheckup() throws Exception {
    UUID id = UUID.randomUUID();
    HealthCheck check = new HealthCheck("PAT123", "DOC123", new BigDecimal("70.5"), new BigDecimal("22.5"), 120, 80, new BigDecimal("100"), new BigDecimal("36.5"), "Normal");
    
    java.lang.reflect.Field idField = HealthCheck.class.getDeclaredField("id");
    idField.setAccessible(true);
    idField.set(check, id);

    when(healthCheckRepository.findById(id)).thenReturn(Optional.of(check));
    when(healthCheckRepository.save(any(HealthCheck.class))).thenReturn(check);

    HealthController.CheckRequest req = new HealthController.CheckRequest(
        "PAT123", new BigDecimal("72.0"), new BigDecimal("23.0"), 125, 82, new BigDecimal("105"), new BigDecimal("36.6"), "Updated");

    mockMvc
        .perform(
            put("/api/v1/checkups/{id}", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
        .andExpect(status().isOk());
  }

  @Test
  void testDeleteCheckup() throws Exception {
    UUID id = UUID.randomUUID();
    HealthCheck check = new HealthCheck("PAT123", "DOC123", new BigDecimal("70.5"), new BigDecimal("22.5"), 120, 80, new BigDecimal("100"), new BigDecimal("36.5"), "Normal");
    
    java.lang.reflect.Field idField = HealthCheck.class.getDeclaredField("id");
    idField.setAccessible(true);
    idField.set(check, id);

    when(healthCheckRepository.findById(id)).thenReturn(Optional.of(check));

    mockMvc.perform(delete("/api/v1/checkups/{id}", id)).andExpect(status().isNoContent());
  }
}
