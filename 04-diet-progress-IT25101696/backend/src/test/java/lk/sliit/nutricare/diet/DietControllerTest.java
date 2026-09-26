package lk.sliit.nutricare.diet;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DietController.class)
class DietControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DietPlanRepository plans;

    @MockBean
    private ProgressLogRepository logs;

    @Test
    @WithMockUser(username = "d1", roles = "DIETITIAN")
    void testGetDietPlan() throws Exception {
        DietPlan plan = new DietPlan("p1", "d1", "Title", 2000, "None", "Schedule");
        when(plans.findById(plan.getId())).thenReturn(Optional.of(plan));

        mockMvc.perform(get("/api/v1/diet-plans/" + plan.getId()))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "d1", roles = "DIETITIAN")
    void testUpdateDietPlan() throws Exception {
        DietPlan plan = new DietPlan("p1", "d1", "Title", 2000, "None", "Schedule");
        when(plans.findById(plan.getId())).thenReturn(Optional.of(plan));
        when(plans.save(any(DietPlan.class))).thenAnswer(i -> i.getArgument(0));

        String json = """
                {
                  "patientId": "p1",
                  "title": "New Title",
                  "calorieTarget": 2500,
                  "exclusions": "None",
                  "mealSchedule": "New Schedule"
                }
                """;

        mockMvc.perform(put("/api/v1/diet-plans/" + plan.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "d1", roles = "DIETITIAN")
    void testDeleteDietPlan() throws Exception {
        DietPlan plan = new DietPlan("p1", "d1", "Title", 2000, "None", "Schedule");
        when(plans.findById(plan.getId())).thenReturn(Optional.of(plan));

        mockMvc.perform(delete("/api/v1/diet-plans/" + plan.getId()))
                .andExpect(status().isNoContent());
    }
}
