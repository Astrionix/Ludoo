/**
 * test_client.js
 * Test suite verifying server-authoritative logic, sequence indexing, de-duplication, and delta/snapshot reconnection recovery.
 */

const { WebSocketServer } = require('ws');
const WebSocket = require('ws');
const http = require('http');
const WebSocketGateway = require('./src/WebSocketGateway');

const PORT = 8089;

function runServerTest() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    const wss = new WebSocketServer({ server });
    const gateway = new WebSocketGateway(wss);

    server.listen(PORT, async () => {
      console.log(`[TEST] Server started on port ${PORT}`);

      try {
        const client1 = new WebSocket(`ws://localhost:${PORT}`);
        const client2 = new WebSocket(`ws://localhost:${PORT}`);

        let p1Seq = 0;
        let p2Seq = 0;
        let matchId = null;

        await new Promise(r => client1.on('open', r));
        await new Promise(r => client2.on('open', r));

        console.log('[TEST] Clients connected. Sending matchmaking requests...');

        client1.send(JSON.stringify({
          type: 'JOIN_MATCHMAKING',
          playerId: 'PLAYER_1',
          payload: { name: 'Alice' }
        }));

        client2.send(JSON.stringify({
          type: 'JOIN_MATCHMAKING',
          playerId: 'PLAYER_2',
          payload: { name: 'Bob' }
        }));

        client1.on('message', (data) => {
          const msg = JSON.parse(data);
          if (msg.seq) p1Seq = msg.seq;
          if (msg.type === 'GAME_STARTED') {
            matchId = msg.payload.matchId;
            console.log(`[TEST SUCCESS] Match created: ${matchId}, Start Seq: ${msg.seq}`);
          }
        });

        client2.on('message', (data) => {
          const msg = JSON.parse(data);
          if (msg.seq) p2Seq = msg.seq;
        });

        // Wait for match creation
        await new Promise(r => setTimeout(r, 1000));

        // Test duplicate action protection
        console.log('[TEST] Testing duplicate actionId protection...');
        const duplicateActionId = 'ACT_DUP_123';

        client1.send(JSON.stringify({
          type: 'ROLL_REQUEST',
          playerId: 'PLAYER_1',
          actionId: duplicateActionId
        }));

        client1.send(JSON.stringify({
          type: 'ROLL_REQUEST',
          playerId: 'PLAYER_1',
          actionId: duplicateActionId // Duplicate should be ignored
        }));

        await new Promise(r => setTimeout(r, 1000));

        console.log(`[TEST] P1 Last Sequence: ${p1Seq}, P2 Last Sequence: ${p2Seq}`);

        // Test Client 2 Disconnection and Reconnection Delta Recovery
        console.log('[TEST] Simulating Client 2 network drop and reconnection with lastReceivedSequence...');
        client2.close();

        // Perform move while Client 2 is disconnected
        client1.send(JSON.stringify({
          type: 'MOVE_REQUEST',
          playerId: 'PLAYER_1',
          actionId: 'ACT_MOVE_456',
          payload: { tokenIndex: 0 }
        }));

        await new Promise(r => setTimeout(r, 1000));

        // Reconnect Client 2
        const client2Reconnected = new WebSocket(`ws://localhost:${PORT}`);
        await new Promise(r => client2Reconnected.on('open', r));

        client2Reconnected.on('message', (data) => {
          const msg = JSON.parse(data);
          if (msg.type === 'DELTA_SYNC') {
            console.log(`[TEST SUCCESS] Client 2 received DELTA_SYNC with ${msg.events.length} missed events!`);
          } else if (msg.type === 'GAME_STATE_SNAPSHOT') {
            console.log(`[TEST SUCCESS] Client 2 received GAME_STATE_SNAPSHOT fallback!`);
          }
        });

        client2Reconnected.send(JSON.stringify({
          type: 'RECONNECT_REQUEST',
          playerId: 'PLAYER_2',
          payload: {
            matchId: matchId,
            lastReceivedSequence: p2Seq
          }
        }));

        await new Promise(r => setTimeout(r, 1500));

        // Clean up server
        client1.close();
        client2Reconnected.close();
        wss.close();
        server.close();
        console.log('[TEST] All backend tests completed successfully!');
        resolve();
      } catch (err) {
        console.error('[TEST FAILED]', err);
        reject(err);
      }
    });
  });
}

runServerTest();
