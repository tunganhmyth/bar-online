package com.example.xiugou.controller;

import com.example.xiugou.service.TikTokLiveService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/live")
public class LiveController {
    private final TikTokLiveService live;

    public LiveController(TikTokLiveService live) { this.live = live; }

    @GetMapping("/state")
    public JsonNode state() { return live.getState(); }

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events() { return live.subscribe(); }

    @PostMapping("/connect")
    public ResponseEntity<?> connect(@RequestBody Map<String, Object> request) {
        Object input = request.get("username");
        if (!(input instanceof String) || ((String) input).trim().isEmpty() || ((String) input).length() > 512) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Nhập @username hoặc link TikTok Live (tối đa 512 ký tự)."));
        }
        try {
            live.connect(((String) input).trim());
            return ResponseEntity.accepted().body(Collections.singletonMap("accepted", true));
        } catch (IOException error) {
            return unavailable();
        }
    }

    @PostMapping("/disconnect")
    public ResponseEntity<?> disconnect() {
        try {
            live.disconnect();
            return ResponseEntity.ok(Collections.singletonMap("accepted", true));
        } catch (IOException error) {
            return unavailable();
        }
    }

    private ResponseEntity<?> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Collections.singletonMap("error",
                "Không khởi chạy được connector TikTok. Kiểm tra Node.js 20+ và chạy npm ci trong thư mục project."));
    }
}
