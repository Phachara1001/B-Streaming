import Peer from "peerjs";
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";
import { saveRoomState, loadRoomState } from "./roomService.js";

const CHANNEL_NAME = "aura_ktv_studio_sync_v1";

function getHostPeerId(roomId) {
  const clean = String(roomId || "BS8899")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `bstreaming-room-host-${clean}`;
}

export function createRoomSync({
  roomId,
  role = "host",
  onStateSync,
  onCommand,
  onRemoteCount,
  onStatus,
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
  let status = "connecting";
  let lastHostSignal = Date.now();
  let onVisible = null;
  let onOnline = null;

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
  const PEER_OPTIONS = {
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
        {
          urls: [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turn:openrelay.metered.ca:443?transport=tcp",
          ],
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
    },
  };

  const outbox = []; // commands waiting for a live host connection
  let stopped = false;
  let hostRetry = 0;

  function setStatus(s) {
    if (status === s) return;
    status = s;
    if (onStatus) onStatus(s);
  }

  function handleHostData(conn) {
    conn.on("data", (msg) => {
      if (!msg) return;
      if (msg.type === "COMMAND" && msg.command) {
        const cid = msg.command.cmdId;
        if (cid && processedCmdIds.has(cid)) {
          if (conn.open) conn.send({ type: "ACK", cmdId: cid });
          return;
        }
        if (cid) processedCmdIds.add(cid);
        if (conn.open && cid) conn.send({ type: "ACK", cmdId: cid });
        if (onCommand) onCommand(msg.command);
      } else if (msg.type === "REQUEST_STATE" || msg.type === "PING") {
        const snap = latestStateCache || (getInitialState ? getInitialState() : null);
        if (snap && conn.open) {
          conn.send({ roomId, type: "SYNC_STATE", state: snap });
        }
      }
    });
  }

  function initHostPeer() {
    const id = getHostPeerId(roomId);
    peer = new Peer(id, PEER_OPTIONS);
    peer.on("connection", (conn) => {
      remoteConnections.set(conn.peer, conn);
      emitTotalRemoteCount();
      conn.on("open", () => {
        remoteConnections.set(conn.peer, conn);
        emitTotalRemoteCount();
        const snap = latestStateCache || (getInitialState ? getInitialState() : null);
        if (snap) conn.send({ roomId, type: "SYNC_STATE", state: snap });
      });
      handleHostData(conn);
      const drop = () => {
        remoteConnections.delete(conn.peer);
        emitTotalRemoteCount();
      };
      conn.on("close", drop);
      conn.on("error", drop);
    });
    peer.on("disconnected", () => {
      if (!stopped && peer && !peer.destroyed) {
        try { peer.reconnect(); } catch (_) {}
      }
    });
    peer.on("error", (err) => {
      if (stopped) return;
      if (err && err.type === "unavailable-id") {
        // stale registration on signaling server: retry shortly
        try { peer.destroy(); } catch (_) {}
        setTimeout(() => !stopped && initHostPeer(), 2500);
      } else if (err && (err.type === "network" || err.type === "server-error" || err.type === "socket-error")) {
        setTimeout(() => {
          if (stopped || !peer) return;
          if (peer.destroyed) initHostPeer();
          else if (peer.disconnected) { try { peer.reconnect(); } catch (_) {} }
        }, 3000);
      }
    });
  }

  function flushOutbox() {
    if (!hostConn || !hostConn.open) return;
    for (const item of outbox) {
      try {
        hostConn.send({ roomId, type: "COMMAND", command: item.command });
      } catch (_) {}
    }
  }

  function destroyClientPeer() {
    try { if (hostConn) hostConn.close(); } catch (_) {}
    hostConn = null;
    try { if (peer && !peer.destroyed) peer.destroy(); } catch (_) {}
    peer = null;
  }

  function initClientPeer() {
    if (stopped) return;
    destroyClientPeer();
    setStatus("connecting");
    peer = new Peer(PEER_OPTIONS);
    const thisPeer = peer;

    peer.on("open", () => connectToHost());
    peer.on("disconnected", () => {
      if (!stopped && thisPeer === peer && !thisPeer.destroyed) {
        try { thisPeer.reconnect(); } catch (_) {}
      }
    });
    peer.on("error", (err) => {
      if (stopped || thisPeer !== peer) return;
      setStatus("connecting");
      if (err && err.type === "peer-unavailable") {
        hostConn = null; // host not there yet: ensureConnected retries
      } else if (thisPeer.destroyed || (err && ["network", "server-error", "socket-error", "socket-closed", "browser-incompatible"].includes(err.type))) {
        setTimeout(() => thisPeer === peer && !stopped && initClientPeer(), 2000);
      }
    });
  }

  function connectToHost() {
    if (stopped || !peer || peer.destroyed || peer.disconnected) return;
    if (hostConn && hostConn.open) return;
    try { if (hostConn) hostConn.close(); } catch (_) {}
    const conn = peer.connect(getHostPeerId(roomId), { reliable: true });
    hostConn = conn;
    conn.on("open", () => {
      hostRetry = 0;
      setStatus("connected");
      conn.send({ type: "REQUEST_STATE", roomId });
      flushOutbox();
    });
    conn.on("data", (msg) => {
      if (!msg) return;
      lastHostSignal = Date.now();
      if (msg.type === "SYNC_STATE" && msg.state && onStateSync) {
        onStateSync(msg.state);
      } else if (msg.type === "ACK") {
        const i = outbox.findIndex((o) => o.command.cmdId === msg.cmdId);
        if (i >= 0) outbox.splice(i, 1);
      }
    });
    const lost = () => {
      if (hostConn === conn) {
        hostConn = null;
        setStatus("connecting");
      }
    };
    conn.on("close", lost);
    conn.on("error", lost);
  }

  // Called by timers + page lifecycle events (unlock, tab visible, network back)
  function ensureConnected(force = false) {
    if (stopped || role === "host") {
      if (role === "host" && peer && peer.disconnected && !peer.destroyed) {
        try { peer.reconnect(); } catch (_) {}
      } else if (role === "host" && (!peer || peer.destroyed)) {
        initHostPeer();
      }
      return;
    }
    if (!peer || peer.destroyed) return initClientPeer();
    if (peer.disconnected) {
      try { peer.reconnect(); } catch (_) { initClientPeer(); }
      return;
    }
    const stale = hostConn && hostConn.open && Date.now() - lastHostSignal > 20000;
    if (force || stale) {
      // After lock screen the data channel is often half-dead: rebuild everything
      if (force || stale) return initClientPeer();
    }
    if (!hostConn || !hostConn.open) {
      hostRetry += 1;
      if (hostRetry > 6 && hostRetry % 6 === 0) return initClientPeer();
      connectToHost();
    } else {
      try { hostConn.send({ type: "PING", roomId }); } catch (_) { initClientPeer(); }
      flushOutbox();
    }
  }

  function initPeerJs() {
    if (typeof window === "undefined") return;
    try {
      if (role === "host") initHostPeer();
      else initClientPeer();
    } catch (_) {
      // PeerJS fallback handled by local API / BroadcastChannel
    }
    reconnectTimer = setInterval(() => ensureConnected(false), 4000);
    onVisible = () => {
      if (document.visibilityState === "visible") ensureConnected(role !== "host");
    };
    onOnline = () => ensureConnected(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onVisible);
  }
  // 3. Supabase Realtime (Broadcast + Presence) : primary transport when configured
  const useDb = Boolean(isSupabaseConfigured && supabase);
  let sbChannel = null;
  let sbSubscribed = false;
  let sbHostPresent = false;
  let sbGotLiveState = false;
  let sbReconnectTimer = null;

  function sbEmitStatus() {
    if (!sbSubscribed) setStatus("connecting");
    else if (role !== "host" && !sbHostPresent) setStatus("host-offline");
    else setStatus("connected");
  }

  function sbSend(event, payload) {
    if (!sbChannel || !sbSubscribed) return false;
    try {
      sbChannel.send({ type: "broadcast", event, payload });
      return true;
    } catch (_) {
      return false;
    }
  }

  function flushSbOutbox() {
    if (!outbox.length) return;
    if (!sbSubscribed) {
      sbConnectIfNeeded();
      return;
    }
    for (const item of outbox) {
      sbSend("command", { command: item.command });
    }
  }

  function sbConnectIfNeeded() {
    if (stopped) return;
    if (!sbChannel || !sbSubscribed) sbConnect();
  }

  function sbCatchUpFromDb() {
    if (role === "host") return;
    loadRoomState(roomId)
      .then((s) => {
        if (s && onStateSync && !sbGotLiveState) onStateSync(s);
      })
      .catch(() => {});
  }

  function sbConnect() {
    if (stopped) return;
    if (sbReconnectTimer) {
      clearTimeout(sbReconnectTimer);
      sbReconnectTimer = null;
    }
    if (sbChannel) {
      try { supabase.removeChannel(sbChannel); } catch (_) {}
      sbChannel = null;
    }
    sbSubscribed = false;
    sbEmitStatus();

    const ch = supabase.channel(`bs-room-${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: clientId } },
    });
    sbChannel = ch;

    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      if (role === "host" || !payload || !payload.state) return;
      sbGotLiveState = true;
      lastHostSignal = Date.now();
      if (onStateSync) onStateSync(payload.state);
    });

    ch.on("broadcast", { event: "command" }, ({ payload }) => {
      if (role !== "host" || !payload || !payload.command) return;
      const cmd = payload.command;
      if (cmd.cmdId) sbSend("ack", { cmdId: cmd.cmdId });
      if (cmd.cmdId && processedCmdIds.has(cmd.cmdId)) return;
      if (cmd.cmdId) processedCmdIds.add(cmd.cmdId);
      if (onCommand) onCommand(cmd);
    });

    ch.on("broadcast", { event: "ack" }, ({ payload }) => {
      if (!payload) return;
      const i = outbox.findIndex((o) => o.command.cmdId === payload.cmdId);
      if (i >= 0) outbox.splice(i, 1);
    });

    ch.on("broadcast", { event: "request_state" }, () => {
      if (role !== "host") return;
      const snap = latestStateCache || (getInitialState ? getInitialState() : null);
      if (snap) sbSend("state", { state: snap });
    });

    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState();
      let remotes = 0;
      let host = false;
      Object.values(st).forEach((metas) =>
        metas.forEach((m) => {
          if (m.role === "host") host = true;
          else remotes += 1;
        }),
      );
      sbHostPresent = host;
      localApiRemoteCount = remotes;
      emitTotalRemoteCount();
      sbEmitStatus();
    });

    ch.subscribe(async (s) => {
      if (stopped || ch !== sbChannel) return;
      if (s === "SUBSCRIBED") {
        sbSubscribed = true;
        try { await ch.track({ role, at: Date.now() }); } catch (_) {}
        if (role === "host") {
          const snap = latestStateCache || (getInitialState ? getInitialState() : null);
          if (snap) sbSend("state", { state: snap });
        } else {
          sbSend("request_state", {});
          flushSbOutbox();
        }
        sbEmitStatus();
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
        sbSubscribed = false;
        sbEmitStatus();
        if (!sbReconnectTimer) {
          sbReconnectTimer = setTimeout(() => {
            sbReconnectTimer = null;
            if (!stopped && ch === sbChannel) sbConnect();
          }, 2500);
        }
      }
    });
  }

  function sbTick(force = false) {
    if (stopped) return;
    if (!sbChannel || !sbSubscribed) return sbConnect();
    if (force) {
      // after unlock / network back: rebuild channel to be safe
      sbConnect();
      return;
    }
    if (role !== "host") {
      flushSbOutbox();
      if (Date.now() - lastHostSignal > 25000) {
        sbSend("request_state", {});
        lastHostSignal = Date.now();
      }
    }
  }

  function initSupabaseTransport() {
    sbConnect();
    sbCatchUpFromDb();
    reconnectTimer = setInterval(() => sbTick(false), 4000);
    onVisible = () => {
      if (document.visibilityState === "visible") {
        sbTick(true);
        sbCatchUpFromDb();
      }
    };
    onOnline = () => sbTick(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onVisible);
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

    if (role === "host") {
      saveRoomState(roomId, cleanSnapshot, cleanSnapshot.roomMusicMode);
    }

    if (useDb) {
      sbSend("state", { state: cleanSnapshot });
      return;
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

    if (role !== "host" && useDb) {
      outbox.push({ command, at: Date.now() });
      while (outbox.length > 50) outbox.shift();
      flushSbOutbox();
      return;
    }

    if (role !== "host") {
      outbox.push({ command, at: Date.now() });
      while (outbox.length > 50) outbox.shift();
      if (hostConn && hostConn.open) {
        try {
          hostConn.send({ roomId, type: "COMMAND", command });
        } catch (_) {
          ensureConnected(true);
        }
      } else {
        ensureConnected(false);
      }
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
      // On Vercel production, /api/room does not exist â€” PeerJS handles sync
    }
  }

  function start() {
    if (useDb) {
      initSupabaseTransport();
      return;
    }
    initPeerJs();
    pollRoom();
    pollTimer = setInterval(pollRoom, 1500);
  }

  function stop() {
    stopped = true;
    if (onVisible) {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("focus", onVisible);
    }
    if (onOnline) window.removeEventListener("online", onOnline);
    if (pollTimer) clearInterval(pollTimer);
    if (reconnectTimer) clearInterval(reconnectTimer);
    if (channel) channel.close();
    if (sbChannel && supabase) {
      try { supabase.removeChannel(sbChannel); } catch (_) {}
      sbChannel = null;
    }
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
