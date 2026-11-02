package com.example.xiugou.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.annotation.PreDestroy;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.*;

@Service
public class TikTokLiveService {
    private static final Logger log = LoggerFactory.getLogger(TikTokLiveService.class);
    private final ObjectMapper mapper;
    private final StageSettingsService stageSettings;
    private final String node;
    private final Path script;
    private final Set<SseEmitter> clients = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "tiktok-heartbeat");
        thread.setDaemon(true);
        return thread;
    });
    private volatile JsonNode state;
    private volatile boolean closing;
    private Process worker;
    private BufferedWriter commands;

    public TikTokLiveService(ObjectMapper mapper, StageSettingsService stageSettings,
                            @Value("${tiktok.node:node}") String node,
                            @Value("${tiktok.script:bridge/worker.mjs}") String script) {
        this.mapper = mapper;
        this.stageSettings = stageSettings;
        this.node = node;
        this.script = Paths.get(script).toAbsolutePath();
        state = idleState(null);
        heartbeat.scheduleAtFixedRate(() -> clients.forEach(client -> {
            try { client.send(SseEmitter.event().comment("keep-alive")); }
            catch (IOException | IllegalStateException error) { removeClient(client); }
        }), 15, 15, TimeUnit.SECONDS);
    }

    public JsonNode getState() { return state.deepCopy(); }

    public synchronized SseEmitter subscribe() {
        SseEmitter client = new SseEmitter(0L);
        clients.add(client);
        client.onCompletion(() -> clients.remove(client));
        client.onTimeout(() -> removeClient(client));
        client.onError(error -> clients.remove(client));
        try {
            client.send(SseEmitter.event().data(envelope("state", state)));
            client.send(SseEmitter.event().data(envelope("stage-settings", stageSettings.get())));
        }
        catch (IOException | IllegalStateException error) { removeClient(client); }
        return client;
    }

    public synchronized JsonNode updateStageSettings(Map<String, Object> patch) throws IOException {
        JsonNode saved = stageSettings.update(patch);
        broadcast(envelope("stage-settings", saved));
        return saved;
    }

    public synchronized void connect(String username) throws IOException {
        ensureWorker();
        ObjectNode command = mapper.createObjectNode();
        command.put("action", "connect");
        command.put("username", username);
        writeCommand(command);
    }

    public synchronized void disconnect() throws IOException {
        if (worker != null && worker.isAlive()) {
            writeCommand(Collections.singletonMap("action", "disconnect"));
        } else {
            state = idleState(null);
            broadcast(envelope("state", state));
        }
    }

    private void writeCommand(Object command) throws IOException {
        commands.write(mapper.writeValueAsString(command));
        commands.newLine();
        commands.flush();
    }

    private void ensureWorker() throws IOException {
        if (closing) throw new IOException("Server đang dừng.");
        if (worker != null && worker.isAlive()) return;
        if (!Files.isRegularFile(script)) throw new IOException("Không tìm thấy " + script);
        Process process = new ProcessBuilder(node, script.toString())
                .redirectError(ProcessBuilder.Redirect.INHERIT).start();
        worker = process;
        commands = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
        Thread reader = new Thread(() -> readEvents(process), "tiktok-events");
        reader.setDaemon(true);
        reader.start();
    }

    private void readEvents(Process process) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                try {
                    JsonNode event = mapper.readTree(line);
                    if (event != null && event.has("type") && event.has("data")) {
                        synchronized (this) {
                            if (worker != process || closing) return;
                            if ("state".equals(event.path("type").asText())) state = event.path("data").deepCopy();
                            broadcast(event);
                        }
                    }
                } catch (IOException error) { log.warn("Ignored invalid TikTok worker output"); }
            }
        } catch (IOException error) {
            if (!closing) log.warn("TikTok worker stream closed: {}", error.getMessage());
        } finally {
            synchronized (this) {
                if (worker == process && !closing) {
                    worker = null;
                    if (process.isAlive()) process.destroy();
                    state = idleState("Connector đã dừng. Kiểm tra Node.js và chạy npm ci, sau đó kết nối lại.");
                    broadcast(envelope("state", state));
                }
            }
        }
    }

    private ObjectNode idleState(String error) {
        ObjectNode idle = mapper.createObjectNode();
        idle.put("connected", false).put("connecting", false).put("username", "").put("viewerCount", 0);
        idle.putNull("roomId");
        if (error == null) idle.putNull("lastError"); else idle.put("lastError", error);
        return idle;
    }

    private ObjectNode envelope(String type, JsonNode data) {
        ObjectNode event = mapper.createObjectNode();
        event.put("type", type);
        event.set("data", data);
        return event;
    }

    private void broadcast(JsonNode event) {
        clients.forEach(client -> {
            try { client.send(SseEmitter.event().data(event)); }
            catch (IOException | IllegalStateException error) { removeClient(client); }
        });
    }

    private void removeClient(SseEmitter client) {
        clients.remove(client);
        client.complete();
    }

    @PreDestroy
    public synchronized void close() {
        closing = true;
        heartbeat.shutdownNow();
        clients.forEach(SseEmitter::complete);
        clients.clear();
        if (worker != null) {
            try {
                commands.close(); // EOF lets the worker disconnect from TikTok cleanly.
                if (!worker.waitFor(3, TimeUnit.SECONDS)) worker.destroyForcibly();
            } catch (IOException error) {
                worker.destroyForcibly();
            } catch (InterruptedException error) {
                worker.destroyForcibly();
                Thread.currentThread().interrupt();
            }
        }
    }
}
