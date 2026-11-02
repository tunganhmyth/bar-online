package com.example.xiugou;

import com.example.xiugou.service.StageSettingsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class StageSettingsTests {
    @TempDir Path temporary;

    @Test
    void persistsHostAndAllCameraModesAcrossRestart() throws Exception {
        Path file = temporary.resolve("settings.json");
        StageSettingsService service = new StageSettingsService(new ObjectMapper(), file.toString());
        assertEquals("Chủ sàn", service.get().path("hostName").asText());
        Map<String, Object> patch = new HashMap<>();
        patch.put("hostName", "  Linh ⚡  ");
        patch.put("cameraMode", "mixed");
        patch.put("laserEnabled", true);
        service.update(patch);
        assertEquals("Linh ⚡", service.get().path("hostName").asText());
        for (String mode : new String[]{"overview", "front", "left", "right", "overhead", "orbit", "closeup", "mixed"}) {
            service.update(Collections.singletonMap("cameraMode", mode));
            assertEquals(mode, service.get().path("cameraMode").asText());
        }
        StageSettingsService restarted = new StageSettingsService(new ObjectMapper(), file.toString());
        assertEquals(service.get(), restarted.get());
        assertTrue(restarted.get().path("laserEnabled").asBoolean());
        long revision = restarted.get().path("revision").asLong();
        assertEquals(revision, restarted.update(Collections.singletonMap("cameraMode", "mixed")).path("revision").asLong());
    }

    @Test
    void rejectsInvalidInputWithoutChangingSavedSettings() throws Exception {
        StageSettingsService service = new StageSettingsService(new ObjectMapper(), temporary.resolve("settings.json").toString());
        service.update(Collections.singletonMap("hostName", "MythMaker"));
        assertThrows(IllegalArgumentException.class, () -> service.update(Collections.singletonMap("hostName", "   ")));
        assertThrows(IllegalArgumentException.class, () -> service.update(Collections.singletonMap("cameraMode", "invalid")));
        assertThrows(IllegalArgumentException.class, () -> service.update(Collections.singletonMap("hostName", 123)));
        assertThrows(IllegalArgumentException.class, () -> service.update(Collections.singletonMap("laserEnabled", "true")));
        assertEquals("MythMaker", service.get().path("hostName").asText());
        assertEquals("overview", service.get().path("cameraMode").asText());
    }

    @Test
    void aFailedWriteDoesNotApplyUnsavedChanges() throws Exception {
        Path blocked = temporary.resolve("blocked");
        Files.write(blocked, new byte[]{1});
        StageSettingsService service = new StageSettingsService(new ObjectMapper(), blocked.resolve("settings.json").toString());
        assertThrows(IOException.class, () -> service.update(Collections.singletonMap("hostName", "Not saved")));
        assertEquals("Chủ sàn", service.get().path("hostName").asText());
        assertEquals(0, service.get().path("revision").asLong());
    }
}
