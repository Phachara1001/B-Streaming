import Peer from "peerjs";

const CHANNEL_NAME = "aura_ktv_studio_sync_v1";

function getHostPeerId(roomId) {
  const clean = String(roomId || "KTV-889")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `auraktv-room-host-${clean}`;
}

export function createRoomSync({
  roomId,
  role = "host",
  onStateSync,
  onCommand,
  onRemoteCount,
  getInitialState,
}) {
  const clientId = `${role}-${Math.random().toString(36).slice(2, 9)}`;
  const processedCmdIds = new Set();
  let lastCmdId = 0;
  let pollTimer = null;
  let reconnectTimer = null;
  let channel = null;
  let peer = null;
  let hostConn = null;
  const remoteConnections = new Map();
  let localApiRemoteCount = 0;
  let latestStateCache = null;

  function emitTotalRemoteCount() {
    if (!onRemoteCount) return;
    const total = Math.max(remoteConnections.size, localApiRemoteCount);
    onRemoteCount(total);
  }

  // 1. Same-Device / Same-Browser BroadcastChannel Sync
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const msg = event.data;
      if (!msg || msg.roomId !== roomId) return;
      if (msg.type === "SYNC_STATE" && role !== "host" && onStateSync) {
        onStateSync(msg.state);
      } else if (msg.type === "COMMAND" && msg.command) {
        const cid = msg.command.cmdId;
        if (cid && processedCmdIds.has(cid)) return;
        if (cid) processedCmdIds.add(cid);
        if (onCommand) onCommand(msg.command);
      }
    };
  }

  // 2. PeerJS (WebRTC) Zero-Database Sync for Vercel / 4G / Cross-Network
  function initPeerJs() {
    if (typeof window === "undefined") return;
    try {
      const targetHostPeerId = getHostPeerId(roomId);

      if (role === "host") {
        peer = new Peer(targetHostPeerId);

        peer.on("connection", (conn) => {
          remoteConnections.set(conn.peer, conn);
          emitTotalRemoteCount();

          conn.on("open", () => {
            remoteConnections.set(conn.peer, conn);
            emitTotalRemoteCount();
            const currentSnap =
              latestStateCache || (getInitialState ? getInitialState() : null);
            if (currentSnap) {
              conn.send({
                roomId,
                type: "SYNC_STATE",
                state: currentSnap,
              });
            }
          });

          conn.on("data", (msg) => {
            if (!msg) return;
            if (msg.type === "COMMAND" && msg.command) {
              const cid = msg.command.cmdId;
              if (cid && processedCmdIds.has(cid)) return;
              if (cid) processedCmdIds.add(cid);
              if (onCommand) onCommand(msg.command);
            } else if (msg.type === "REQUEST_STATE") {
              const currentSnap =
                latestStateCache ||
                (getInitialState ? getInitialState() : null);
              if (currentSnap && conn.open) {
                conn.send({
                  roomId,
                  type: "SYNC_STATE",
                  state: currentSnap,
                });
              }
            }
          });

          conn.on("close", () => {
            remoteConnections.delete(conn.peer);
            emitTotalRemoteCount();
          });

          conn.on("error", () => {
            remoteConnections.delete(conn.peer);
            emitTotalRemoteCount();
          });
        });
      } else {
        // Remote Client Peer
        peer = new Peer();

        const connectToHost = () => {
          if (!peer || peer.destroyed) return;
          if (hostConn && hostConn.open) return;

          const conn = peer.connect(targetHostPeerId, { reliable: true });
          hostConn = conn;

          conn.on("open", () => {
            conn.send({ type: "REQUEST_STATE", roomId });
          });

          conn.on("data", (msg) => {
            if (!msg) return;
            if (msg.type === "SYNC_STATE" && msg.state && onStateSync) {
              onStateSync(msg.state);
            }
          });

          conn.on("close", () => {
            hostConn = null;
          });
        };

        peer.on("open", () => {
          connectToHost();
          reconnectTimer = setInterval(() => {
            if (!hostConn || !hostConn.open) {
              connectToHost();
            }
          }, 3500);
        });
      }
    } catch (_) {
      // PeerJS fallback handled by local API / BroadcastChannel
    }
  }

  async function pushStateToServer(stateSnapshot) {
    const cleanSnapshot = JSON.parse(JSON.stringify(stateSnapshot));
    latestStateCache = cleanSnapshot;

    if (channel) {
      channel.postMessage({
        roomId,
        type: "SYNC_STATE",
        state: cleanSnapshot,
      });
    }

    // Broadcast to all connected WebRTC PeerJS remotes
    for (const [peerId, conn] of remoteConnections.entries()) {
      if (conn && conn.open) {
        try {
          conn.send({
            roomId,
            type: "SYNC_STATE",
            state: cleanSnapshot,
          });
        } catch (_) {}
      } else {
        remoteConnections.delete(peerId);
      }
    }

    // Also sync to local dev middleware if available
    try {
      await fetch(
        `/api/room?room=${encodeURIComponent(roomId)}&clientId=${clientId}&role=${role}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "SYNC_STATE",
            state: cleanSnapshot,
          }),
        },
      );
    } catch (_) {}
  }

  async function sendCommand(action, payload = {}, sender = "Mobile Remote") {
    const cmdId = Date.now() + Math.floor(Math.random() * 10000);
    const command = {
      cmdId,
      action,
      payload: JSON.parse(JSON.stringify(payload)),
      sender,
    };
    processedCmdIds.add(cmdId);

    if (channel) {
      channel.postMessage({
        roomId,
        type: "COMMAND",
        command,
      });
    }

    if (hostConn && hostConn.open) {
      try {
        hostConn.send({
          roomId,
          type: "COMMAND",
          command,
        });
      } catch (_) {}
    }

    if (role === "host" && onCommand) {
      onCommand(command);
    }

    try {
      await fetch(
        `/api/room?room=${encodeURIComponent(roomId)}&clientId=${clientId}&role=${role}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "COMMAND",
            command,
          }),
        },
      );
    } catch (_) {}
  }

  async function pollRoom() {
    try {
      const res = await fetch(
        `/api/room?room=${encodeURIComponent(roomId)}&clientId=${clientId}&role=${role}&sinceCmd=${lastCmdId}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.remoteCount === "number") {
        localApiRemoteCount = data.remoteCount;
        emitTotalRemoteCount();
      }
      if (role !== "host" && data.state && onStateSync) {
        onStateSync(data.state);
      }
      if (Array.isArray(data.commands)) {
        for (const cmd of data.commands) {
          if (cmd.cmdId > lastCmdId) {
            lastCmdId = cmd.cmdId;
          }
          if (!processedCmdIds.has(cmd.cmdId)) {
            processedCmdIds.add(cmd.cmdId);
            if (onCommand) onCommand(cmd);
          }
        }
      }
    } catch (_) {
      // On Vercel production, /api/room does not exist — PeerJS handles sync
    }
  }

  function start() {
    initPeerJs();
    pollRoom();
    pollTimer = setInterval(pollRoom, 1500);
  }

  function stop() {
    if (pollTimer) clearInterval(pollTimer);
    if (reconnectTimer) clearInterval(reconnectTimer);
    if (channel) channel.close();
    if (peer && !peer.destroyed) {
      try {
        peer.destroy();
      } catch (_) {}
    }
  }

  return {
    clientId,
    start,
    stop,
    pushStateToServer,
    sendCommand,
  };
}
