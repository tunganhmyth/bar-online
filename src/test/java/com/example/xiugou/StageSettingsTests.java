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
        patch.put("hostCharacter", "luna");
        patch.put("stageName", "  Lâu Đài Ánh Trăng  ");
        patch.put("musicTrack", "ket-thuc-va-chia-tay");
        service.update(patch);
        assertEquals("Linh ⚡", service.get().path("hostName").asText());
        for (String mode : new String[]{"overview", "front", "left", "right", "overhead", "orbit", "closeup", "mixed"}) {
            service.update(Collections.singletonMap("cameraMode", mode));
            assertEquals(mode, service.get().path("cameraMode").asText());
        }
        StageSettingsService restarted = new StageSettingsService(new ObjectMapper(), file.toString());
        assertEquals(service.get(), restarted.get());
        assertEquals("Lâu Đài Ánh Trăng", restarted.get().path("stageName").asText());
        assertTrue(restarted.get().path("laserEnabled").asBoolean());
        assertEquals("luna", restarted.get().path("hostCharacter").asText());
        assertEquals("ket-thuc-va-chia-tay", restarted.get().path("musicTrack").asText());
        for (String character : new String[]{"sakura", "yuki", "akira", "luna", "hikari"}) {
            restarted.update(Collections.singletonMap("hostCharacter", character));
            assertEquals(character, restarted.get().path("hostCharacter").asText());
        }
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
        assertThrows(IllegalArgumentException.class, () -> service.update(Collections.singletonMap("hostCharacter", "unknown")));
        assertThrows(IllegalArgumentException.class, () -> service.update(Collections.singletonMap("stageName", "  ")));
        assertThrows(IllegalArgumentException.class, () -> service.update(Collections.singletonMap("stageName", 123)));
        assertThrows(IllegalArgumentException.class, () -> service.update(Collections.singletonMap("stageName", String.join("", Collections.nCopies(33, "a")))));
        assertThrows(IllegalArgumentException.class, () -> service.update(Collections.singletonMap("musicTrack", "../../unknown.mp3")));
        assertThrows(IllegalArgumentException.class, () -> service.update(Collections.singletonMap("musicTrack", 123)));
        assertEquals("forever-one-love", service.get().path("musicTrack").asText());
        assertEquals("MythMaker", service.get().path("hostName").asText());
        assertEquals("overview", service.get().path("cameraMode").asText());
    }

    @Test
    void olderSettingsFilesKeepTheirValuesAndDefaultStageName() throws Exception {
        Path file = temporary.resolve("old-settings.json");
        new ObjectMapper().writeValue(file.toFile(), Collections.singletonMap("hostName", "Old host"));
        StageSettingsService service = new StageSettingsService(new ObjectMapper(), file.toString());
        assertEquals("MYTHMAKER", service.get().path("stageName").asText());
        assertEquals("Old host", service.get().path("hostName").asText());
        assertEquals("forever-one-love", service.get().path("musicTrack").asText());
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
