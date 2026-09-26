package lk.sliit.nutricare.access;

import static org.mockito.Mockito.doNothing;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MedicalDocumentController.class)
@Import(SecurityConfig.class)
public class MedicalDocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DocumentStorageService documentStorageService;
    
    @MockBean
    private TokenService tokenService;

    @MockBean
    private UserRepository userRepository;

    @Test
    @WithMockUser(username = "patientUser", roles = "PATIENT")
    public void testDeleteDocumentSuccess() throws Exception {
        doNothing().when(documentStorageService).deleteDocument("patientUser", 1L);

        mockMvc.perform(delete("/api/v1/patient/documents/1").with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    @WithMockUser(username = "otherUser", roles = "DOCTOR")
    public void testDeleteDocumentForbidden() throws Exception {
        mockMvc.perform(delete("/api/v1/patient/documents/1").with(csrf()))
                .andExpect(status().isForbidden());
    }
}
