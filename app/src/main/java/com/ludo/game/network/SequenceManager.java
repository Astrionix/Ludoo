package com.ludo.game.network;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Map;
import java.util.TreeMap;

public class SequenceManager {
    private long lastReceivedSequence = 0;
    private final TreeMap<Long, JSONObject> pendingEvents = new TreeMap<>();

    public synchronized void reset(long initialSeq) {
        this.lastReceivedSequence = initialSeq;
        this.pendingEvents.clear();
    }

    public synchronized long getLastReceivedSequence() {
        return lastReceivedSequence;
    }

    public synchronized void setLastReceivedSequence(long seq) {
        this.lastReceivedSequence = seq;
    }

    /**
     * Inspects incoming event sequence number.
     * Returns true if event is the exact next sequence (#lastReceivedSequence + 1).
     * If higher sequence arrives (out of order), buffers it for later execution.
     * If already processed sequence arrives, ignores it.
     */
    public synchronized boolean processIncomingEvent(JSONObject eventObj, EventProcessor processor) {
        long seq = eventObj.optLong("seq", -1);
        if (seq <= 0) {
            // Unsequenced control message (e.g. PONG or ACK)
            processor.execute(eventObj);
            return true;
        }

        if (seq <= lastReceivedSequence) {
            // Already processed; duplicate packet
            return false;
        }

        if (seq == lastReceivedSequence + 1) {
            // Exact next event
            lastReceivedSequence = seq;
            processor.execute(eventObj);

            // Process any buffered subsequent events in order
            while (!pendingEvents.isEmpty() && pendingEvents.firstKey() == lastReceivedSequence + 1) {
                Map.Entry<Long, JSONObject> entry = pendingEvents.pollFirstEntry();
                lastReceivedSequence = entry.getKey();
                processor.execute(entry.getValue());
            }
            return true;
        } else {
            // Gap detected: buffer out-of-order event
            pendingEvents.put(seq, eventObj);
            return false;
        }
    }

    public JSONObject createAckPayload(long seq) {
        JSONObject ack = new JSONObject();
        try {
            ack.put("type", "ACK");
            ack.put("seq", seq);
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return ack;
    }

    public interface EventProcessor {
        void execute(JSONObject eventObj);
    }
}
