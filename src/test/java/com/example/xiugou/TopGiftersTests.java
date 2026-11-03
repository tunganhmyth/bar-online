package com.example.xiugou;

import com.example.xiugou.service.TopGiftersService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class TopGiftersTests {
    final ObjectMapper mapper = new ObjectMapper();
    final TopGiftersService service = new TopGiftersService(mapper);
    ObjectNode gift(String id, long count, long diamonds) {
        return mapper.createObjectNode().put("uniqueId", id).put("nickname", "Tên " + id).put("count", count).put("diamonds", diamonds);
    }
    ObjectNode state(boolean connected, String channel, String room) {
        return mapper.createObjectNode().put("connected", connected).put("username", channel).put("roomId", room);
    }

    @Test void sumsDeltasOnceAndPromotesTheTopThree() {
        service.observeState(state(true, "creator", "room1"));
        service.recordGift(gift("a", 5, 50)); service.recordGift(gift("b", 1, 100));
        service.recordGift(gift("c", 2, 20)); service.recordGift(gift("d", 1, 10));
        assertEquals(3, service.get().path("leaders").size());
        assertEquals("b", service.get().path("leaders").get(0).path("uniqueId").asText());
        assertEquals(50, service.get().path("leaders").get(1).path("diamonds").asLong());
        service.recordGift(gift("a", 2, 60));
        ObjectNode snapshot = service.get();
        assertEquals("a", snapshot.path("leaders").get(0).path("uniqueId").asText());
        assertEquals(1, snapshot.path("leaders").get(0).path("rank").asInt());
        assertEquals(110, snapshot.path("leaders").get(0).path("diamonds").asLong());
        assertEquals(7, snapshot.path("leaders").get(0).path("gifts").asLong());
        long revision = snapshot.path("revision").asLong();
        assertFalse(service.recordGift(gift("a", 0, 999)));
        assertFalse(service.recordGift(gift("demo", 1, 999).put("preview", true)));
        assertEquals(revision, service.get().path("revision").asLong());
        ((ObjectNode) snapshot.path("leaders").get(0)).put("nickname", "Changed outside service");
        assertEquals("Tên a", service.get().path("leaders").get(0).path("nickname").asText());
    }

    @Test void reconnectsKeepScoresButANewChannelOrRoomStartsANewBoard() {
        service.observeState(state(true, "creator", "room1")); service.recordGift(gift("a", 1, 25));
        assertFalse(service.observeState(state(false, "", "")));
        assertFalse(service.observeState(state(true, "creator", "room1")));
        assertEquals(25, service.get().path("leaders").get(0).path("diamonds").asInt());
        long session = service.get().path("session").asLong();
        assertTrue(service.observeState(state(true, "creator", "room2")));
        assertEquals(0, service.get().path("leaders").size());
        assertTrue(service.get().path("session").asLong() > session);
        service.recordGift(gift("a", 1, 25));
        assertTrue(service.observeState(state(true, "other", "room2")));
        assertEquals(0, service.get().path("leaders").size());
    }

    @Test void characterChoicesAndTieOrderAreStable() {
        service.observeState(state(true, "creator", "room1"));
        service.observeChat(mapper.createObjectNode().put("uniqueId", "a").put("comment", "!akira"));
        service.recordGift(gift("a", 1, 10)); service.recordGift(gift("b", 1, 10));
        assertEquals("a", service.get().path("leaders").get(0).path("uniqueId").asText());
        assertEquals("akira", service.get().path("leaders").get(0).path("characterId").asText());
        assertTrue(service.observeChat(mapper.createObjectNode().put("uniqueId", "a").put("comment", "đổi đồ")));
        assertEquals("luna", service.get().path("leaders").get(0).path("characterId").asText());
        service.recordGift(gift("b", 3, 0));
        assertEquals("b", service.get().path("leaders").get(0).path("uniqueId").asText());
        assertEquals(10, service.get().path("leaders").get(0).path("diamonds").asLong());
    }
}
