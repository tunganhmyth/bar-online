package com.example.xiugou.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@Service
public class StageSettingsService {
    private static final Logger log = LoggerFactory.getLogger(StageSettingsService.class);
    private static final Set<String> MODES = new HashSet<>(Arrays.asList(
            "overview", "front", "left", "right", "overhead", "orbit", "closeup", "mixed"));
    private static final Set<String> CHARACTERS = new HashSet<>(Arrays.asList("sakura", "yuki", "akira", "luna", "hikari"));
    private static final Set<String> MUSIC_TRACKS = new HashSet<>(Arrays.asList("forever-one-love", "hon-bat-cu-ai", "ket-thuc-va-chia-tay", "ngay-nay-nam-ay", "nonstop-vinahouse"));
    private final ObjectMapper mapper;
    private final Path path;
    private ObjectNode settings;

    public StageSettingsService(ObjectMapper mapper,
                                @Value("${stage.settings-file:data/stage-settings.json}") String file) {
        this.mapper = mapper;
        this.path = Paths.get(file).toAbsolutePath();
        settings = mapper.createObjectNode().put("stageName", "MYTHMAKER").put("hostName", "Chủ sàn").put("hostCharacter", "sakura").put("cameraMode", "overview").put("laserEnabled", false).put("musicTrack", "forever-one-love").put("revision", 0L);
        if (Files.isRegularFile(path)) {
            try {
                JsonNode saved = mapper.readTree(path.toFile());
                String host = saved.path("hostName").asText("").trim();
                String stage = saved.path("stageName").asText("").trim();
                if (!stage.isEmpty() && stage.length() <= 32) settings.put("stageName", stage);
                String mode = saved.path("cameraMode").asText("");
                if (!host.isEmpty() && host.length() <= 40) settings.put("hostName", host);
                if (MODES.contains(mode)) settings.put("cameraMode", mode);
                if (CHARACTERS.contains(saved.path("hostCharacter").asText())) settings.put("hostCharacter", saved.path("hostCharacter").asText());
                if (saved.path("laserEnabled").isBoolean()) settings.put("laserEnabled", saved.path("laserEnabled").asBoolean());
                if (MUSIC_TRACKS.contains(saved.path("musicTrack").asText())) settings.put("musicTrack", saved.path("musicTrack").asText());
                settings.put("revision", Math.max(0, saved.path("revision").asLong()));
            } catch (IOException | RuntimeException error) {
                log.warn("Cannot load stage settings; using defaults: {}", error.getMessage());
            }
        }
    }

    public synchronized ObjectNode get() { return settings.deepCopy(); }

    public synchronized ObjectNode update(Map<String, Object> patch) throws IOException {
        ObjectNode next = settings.deepCopy();
        if (!patch.containsKey("stageName") && !patch.containsKey("hostName") && !patch.containsKey("hostCharacter") && !patch.containsKey("cameraMode") && !patch.containsKey("laserEnabled") && !patch.containsKey("musicTrack")) {
            throw new IllegalArgumentException("Chưa có cài đặt cần thay đổi.");
        }
        if (patch.containsKey("hostName")) {
            Object value = patch.get("hostName");
            if (!(value instanceof String)) throw new IllegalArgumentException("Tên chủ sàn phải là văn bản.");
            String name = ((String) value).trim().replaceAll("[\\r\\n\\t]+", " ");
            if (name.isEmpty() || name.length() > 40) throw new IllegalArgumentException("Tên chủ sàn cần từ 1 đến 40 ký tự.");
            next.put("hostName", name);
        }
        if (patch.containsKey("stageName")) {
            Object value = patch.get("stageName");
            if (!(value instanceof String)) throw new IllegalArgumentException("Tên sàn phải là văn bản.");
            String name = ((String) value).trim().replaceAll("[\\r\\n\\t]+", " ");
            if (name.isEmpty() || name.length() > 32) throw new IllegalArgumentException("Tên sàn cần từ 1 đến 32 ký tự.");
            next.put("stageName", name);
        }
        if (patch.containsKey("cameraMode")) {
            Object value = patch.get("cameraMode");
            if (!(value instanceof String) || !MODES.contains(value)) throw new IllegalArgumentException("Chế độ camera không hợp lệ.");
            next.put("cameraMode", (String) value);
        }
        if (patch.containsKey("hostCharacter")) {
            Object value = patch.get("hostCharacter");
            if (!(value instanceof String) || !CHARACTERS.contains(value)) throw new IllegalArgumentException("Nhân vật không hợp lệ.");
            next.put("hostCharacter", (String) value);
        }
        if (patch.containsKey("laserEnabled")) {
            Object value = patch.get("laserEnabled");
            if (!(value instanceof Boolean)) throw new IllegalArgumentException("Cài đặt đèn laser phải là bật hoặc tắt.");
            next.put("laserEnabled", (Boolean) value);
        }
        if (patch.containsKey("musicTrack")) {
            Object value = patch.get("musicTrack");
            if (!(value instanceof String) || !MUSIC_TRACKS.contains(value)) throw new IllegalArgumentException("Bài nhạc không hợp lệ.");
            next.put("musicTrack", (String) value);
        }
        if (next.equals(settings)) return get();
        next.put("revision", settings.path("revision").asLong() + 1);
        Files.createDirectories(path.getParent());
        Path temporary = Files.createTempFile(path.getParent(), "stage-settings-", ".tmp");
        try {
            mapper.writerWithDefaultPrettyPrinter().writeValue(temporary.toFile(), next);
            try {
                Files.move(temporary, path, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException ignored) {
                Files.move(temporary, path, StandardCopyOption.REPLACE_EXISTING);
            }
        } finally {
            Files.deleteIfExists(temporary);
        }
        settings = next;
        return get();
    }
}
