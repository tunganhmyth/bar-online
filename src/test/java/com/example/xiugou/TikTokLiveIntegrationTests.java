package com.example.xiugou;

import com.example.xiugou.service.TikTokLiveService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterAll;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "tiktok.script=src/test/resources/fake-tiktok-worker.mjs")
@ActiveProfiles("local")
class TikTokLiveIntegrationTests {
    private static final Path SETTINGS_FILE = Paths.get(System.getProperty("java.io.tmpdir"), "mythmaker-test-" + UUID.randomUUID() + ".json");
    @DynamicPropertySource
    static void stageProperties(DynamicPropertyRegistry registry) {
        registry.add("stage.settings-file", () -> SETTINGS_FILE.toString());
    }
    @AfterAll
    static void removeSettings() throws Exception { Files.deleteIfExists(SETTINGS_FILE); }
    @LocalServerPort int port;
    @Autowired TestRestTemplate http;
    @Autowired TikTokLiveService live;
    @Autowired ObjectMapper mapper;

    @Test
    void updatesStageSettingsAndSynchronizesObservers() throws Exception {
        HttpURLConnection stream = (HttpURLConnection) new URL("http://localhost:" + port + "/api/live/events").openConnection();
        stream.setReadTimeout(5000);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream.getInputStream(), StandardCharsets.UTF_8))) {
            Map<String, Object> update = new HashMap<>();
            update.put("hostName", "Chủ sàn Linh"); update.put("cameraMode", "mixed");
            JsonNode saved = http.exchange("/api/stage/settings", HttpMethod.PUT, new HttpEntity<>(update), JsonNode.class).getBody();
            assertNotNull(saved);
            assertEquals("Chủ sàn Linh", saved.path("hostName").asText());
            assertEquals("mixed", saved.path("cameraMode").asText());
            boolean received = false;
            for (int lines = 0; lines < 30 && !received; lines++) {
                String line = reader.readLine(); assertNotNull(line);
                if (line.startsWith("data:")) {
                    JsonNode event = mapper.readTree(line.substring(5));
                    received = "stage-settings".equals(event.path("type").asText())
                            && event.path("data").path("revision").asLong() == saved.path("revision").asLong();
                }
            }
            assertTrue(received, "Settings update reaches existing OBS/browser streams");
            assertEquals(saved, http.getForObject("/api/stage/settings", JsonNode.class));
            assertEquals(HttpStatus.BAD_REQUEST, http.exchange("/api/stage/settings", HttpMethod.PUT,
                    new HttpEntity<>(Collections.singletonMap("cameraMode", "invalid")), String.class).getStatusCode());
            assertEquals(saved, http.getForObject("/api/stage/settings", JsonNode.class));
        } finally { stream.disconnect(); }
    }

    @Test
    void rendersTikTokPageWithoutCallingBilibili() {
        String page = http.getForObject("/index/some.creator", String.class);
        assertTrue(page.contains("TikTok LIVE"));
        assertTrue(page.contains("value=\"some.creator\""));
        assertFalse(page.contains("decode.js"));
        assertEquals(HttpStatus.OK, http.getForEntity("/", String.class).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST,
                http.postForEntity("/api/live/connect", Collections.singletonMap("username", ""), String.class).getStatusCode());
    }

    @Test
    void forwardsWorkerEventsThroughSseAndDisconnects() throws Exception {
        HttpURLConnection stream = (HttpURLConnection) new URL("http://localhost:" + port + "/api/live/events").openConnection();
        stream.setConnectTimeout(5000);
        stream.setReadTimeout(5000);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream.getInputStream(), StandardCharsets.UTF_8))) {
            assertEquals("text/event-stream", stream.getContentType());
            assertEquals(HttpStatus.ACCEPTED, http.postForEntity("/api/live/connect",
                    Collections.singletonMap("username", "@creator"), String.class).getStatusCode());
            boolean connected = false;
            boolean chat = false;
            for (int lines = 0; lines < 30 && (!connected || !chat); lines++) {
                String line = reader.readLine();
                assertNotNull(line);
                if (!line.startsWith("data:")) continue;
                JsonNode event = mapper.readTree(line.substring(5));
                if ("state".equals(event.path("type").asText()) && event.path("data").path("connected").asBoolean()) connected = true;
                if ("chat".equals(event.path("type").asText())) {
                    assertEquals("Xin chào TikTok", event.path("data").path("comment").asText());
                    chat = true;
                }
            }
            assertTrue(connected, "Worker connection state reaches the browser stream");
            assertTrue(chat, "UTF-8 chat reaches the browser stream");
            assertEquals("fixture-room", http.getForObject("/api/live/state", JsonNode.class).path("roomId").asText());
            assertEquals(HttpStatus.OK, http.postForEntity("/api/live/disconnect", null, String.class).getStatusCode());
            boolean disconnected = false;
            for (int lines = 0; lines < 10 && !disconnected; lines++) {
                String line = reader.readLine();
                assertNotNull(line);
                if (line.startsWith("data:")) {
                    JsonNode event = mapper.readTree(line.substring(5));
                    disconnected = "state".equals(event.path("type").asText()) && !event.path("data").path("connected").asBoolean();
                }
            }
            assertTrue(disconnected);
        } finally {
            stream.disconnect();
            live.disconnect();
        }
    }
}
