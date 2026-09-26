package lk.sliit.nutricare.message;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.test.context.ContextConfiguration;

@WebMvcTest(MessageController.class)
@AutoConfigureMockMvc(addFilters = false)
@ContextConfiguration(classes = {MessageController.class, MessageControllerTest.TestConfig.class})
public class MessageControllerTest {

  @SpringBootConfiguration
  @EnableAutoConfiguration
  static class TestConfig {}

  @Autowired private MockMvc mockMvc;

  @MockBean private MessageRepository messageRepository;

  @MockBean private NotificationRepository notificationRepository;

  @Test
  @WithMockUser(roles = "SYSTEM_ADMIN")
  void testReadNotification() throws Exception {
    UUID id = UUID.randomUUID();
    Notification notification = new Notification("REC123", "ALERT", "IN_APP", "Test", "DELIVERED");
    
    java.lang.reflect.Field idField = Notification.class.getDeclaredField("id");
    idField.setAccessible(true);
    idField.set(notification, id);

    when(notificationRepository.findById(id)).thenReturn(Optional.of(notification));
    when(notificationRepository.save(any(Notification.class))).thenReturn(notification);

    mockMvc
        .perform(put("/api/v1/notifications/{id}/read", id))
        .andExpect(status().isNoContent());

    verify(notificationRepository).save(any(Notification.class));
  }

  @Test
  @WithMockUser(roles = "SYSTEM_ADMIN")
  void testDeleteMessage() throws Exception {
    UUID id = UUID.randomUUID();

    mockMvc
        .perform(delete("/api/v1/messages/{id}", id))
        .andExpect(status().isNoContent());

    verify(messageRepository).deleteById(id);
  }

  @Test
  @WithMockUser(roles = "SYSTEM_ADMIN")
  void testDeleteNotification() throws Exception {
    UUID id = UUID.randomUUID();

    mockMvc
        .perform(delete("/api/v1/notifications/{id}", id))
        .andExpect(status().isNoContent());

    verify(notificationRepository).deleteById(id);
  }
}
