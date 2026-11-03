package com.example.xiugou.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import java.util.*;

/** Scores normalized gift deltas once on the server; SSE consumers never add scores. */
@Service
public class TopGiftersService {
    private static final List<String> CHARACTERS = Arrays.asList("sakura", "yuki", "akira", "luna", "hikari");
    private static final Set<String> CYCLE = new HashSet<>(Arrays.asList("đổi đồ", "doi do", "đổi nhân vật", "doi nhan vat", "đổi chó", "doi cho", "đổi cún", "doi cun", "换修勾"));
    private final ObjectMapper mapper;
    private final String epoch = UUID.randomUUID().toString();
    private final Map<String, Entry> entries = new HashMap<>();
    private final Map<String, String> characters = new HashMap<>();
    private long revision, session, sequence;
    private String channel = "", roomId = "";

    public TopGiftersService(ObjectMapper mapper) { this.mapper = mapper; }

    public synchronized boolean observeState(JsonNode state) {
        if (!state.path("connected").asBoolean()) return false;
        String nextChannel = state.path("username").asText("").trim().toLowerCase(Locale.ROOT);
        String nextRoom = state.path("roomId").asText("");
        if (nextChannel.isEmpty()) return false;
        boolean changed = !channel.equals(nextChannel)
                || (!roomId.isEmpty() && !nextRoom.isEmpty() && !roomId.equals(nextRoom));
        if (changed) {
            entries.clear(); characters.clear(); sequence = 0; session++;
            channel = nextChannel; roomId = nextRoom; revision++;
        } else if (!nextRoom.isEmpty() && !nextRoom.equals(roomId)) {
            roomId = nextRoom; revision++; changed = true;
        }
        return changed;
    }

    public synchronized boolean recordGift(JsonNode gift) {
        String id = gift.path("uniqueId").asText("").trim();
        long count = Math.max(0, gift.path("count").asLong(1));
        if (id.isEmpty() || count == 0 || gift.path("preview").asBoolean()) return false;
        Entry entry = entries.get(id);
        if (entry == null) { entry = new Entry(id, sequence++); entries.put(id, entry); }
        String nickname = gift.path("nickname").asText(id).trim();
        entry.nickname = nickname.isEmpty() ? id : nickname.substring(0, Math.min(80, nickname.length()));
        entry.avatar = gift.path("avatar").asText("");
        // diamonds already includes this delta's count in the connector.
        entry.diamonds = add(entry.diamonds, Math.max(0, gift.path("diamonds").asLong()));
        entry.gifts = add(entry.gifts, count);
        revision++;
        return true;
    }

    public synchronized boolean observeChat(JsonNode chat) {
        String id = chat.path("uniqueId").asText("").trim();
        if (id.isEmpty()) return false;
        String command = chat.path("comment").asText("").trim().toLowerCase(Locale.ROOT);
        String selected = null;
        for (String name : CHARACTERS) {
            if (command.equals("!" + name) || command.equals("nhân vật " + name) || command.equals("nhan vat " + name)) selected = name;
        }
        if (CYCLE.contains(command)) selected = CHARACTERS.get((CHARACTERS.indexOf(character(id)) + 1) % CHARACTERS.size());
        if (selected == null || selected.equals(character(id))) return false;
        characters.put(id, selected);
        if (!entries.containsKey(id)) return false;
        revision++;
        return true;
    }

    private String character(String id) {
        return characters.getOrDefault(id, CHARACTERS.get((int) (Integer.toUnsignedLong(id.hashCode()) % CHARACTERS.size())));
    }

    private static long add(long first, long second) {
        return Long.MAX_VALUE - first < second ? Long.MAX_VALUE : first + second;
    }

    public synchronized ObjectNode get() {
        ObjectNode result = mapper.createObjectNode().put("epoch", epoch).put("session", session)
                .put("revision", revision).put("channel", channel).put("roomId", roomId);
        ArrayNode leaders = result.putArray("leaders");
        entries.values().stream().sorted(Comparator.comparingLong((Entry entry) -> entry.diamonds).reversed()
                .thenComparing(Comparator.comparingLong((Entry entry) -> entry.gifts).reversed())
                .thenComparingLong(entry -> entry.order)).limit(3).forEach(entry -> {
            int rank = leaders.size() + 1;
            leaders.addObject().put("rank", rank).put("uniqueId", entry.id)
                    .put("nickname", entry.nickname).put("avatar", entry.avatar)
                    .put("diamonds", entry.diamonds).put("gifts", entry.gifts).put("characterId", character(entry.id));
        });
        return result;
    }

    private static class Entry {
        final String id;
        final long order;
        String nickname, avatar = "";
        long diamonds, gifts;
        Entry(String id, long order) { this.id = id; this.order = order; this.nickname = id; }
    }
}
