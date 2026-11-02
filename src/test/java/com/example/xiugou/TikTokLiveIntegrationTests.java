package com.example.xiugou;

import com.example.xiugou.service.TikTokLiveService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "tiktok.script=src/test/resources/fake-tiktok-worker.mjs")
@ActiveProfiles("local")
class TikTokLiveIntegrationTests {
    @LocalServerPort int port;
    @Autowired TestRestTemplate http;
    @Autowired TikTokLiveService live;
    @Autowired ObjectMapper mapper;

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
