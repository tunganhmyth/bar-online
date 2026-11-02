package com.example.xiugou.controller;

import com.example.xiugou.service.StageSettingsService;
import com.example.xiugou.service.TikTokLiveService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/stage/settings")
public class StageController {
    private final StageSettingsService settings;
    private final TikTokLiveService live;

    public StageController(StageSettingsService settings, TikTokLiveService live) {
        this.settings = settings;
        this.live = live;
    }

    @GetMapping
    public JsonNode get() { return settings.get(); }

    @PutMapping
    public ResponseEntity<?> update(@RequestBody Map<String, Object> patch) {
        try {
            return ResponseEntity.ok(live.updateStageSettings(patch));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", error.getMessage()));
        } catch (IOException error) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "Không lưu được cài đặt sân khấu. Kiểm tra quyền ghi thư mục data."));
        }
    }
}
