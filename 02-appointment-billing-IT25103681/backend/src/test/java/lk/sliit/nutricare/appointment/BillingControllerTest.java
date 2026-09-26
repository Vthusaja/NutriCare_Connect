package lk.sliit.nutricare.appointment;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(BillingController.class)
class BillingControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockBean private AppointmentService service;

  @Test
  @WithMockUser(roles = "RECEPTION_STAFF")
  void testGetInvoice() throws Exception {
    UUID id = UUID.randomUUID();
    Invoice mockInvoice = new Invoice(UUID.randomUUID(), new BigDecimal("100.00"));
    when(service.requireInvoice(id)).thenReturn(mockInvoice);

    mockMvc.perform(get("/api/v1/billing/invoices/" + id))
        .andExpect(status().isOk());
  }

  @Test
  @WithMockUser(roles = "FINANCE_EXECUTIVE")
  void testUpdateInvoice() throws Exception {
    UUID id = UUID.randomUUID();
    Invoice mockInvoice = new Invoice(UUID.randomUUID(), new BigDecimal("100.00"));
    when(service.updateInvoice(eq(id), eq("PAID"))).thenReturn(mockInvoice);

    mockMvc.perform(put("/api/v1/billing/invoices/" + id)
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"status\":\"PAID\"}"))
        .andExpect(status().isOk());
  }
}
