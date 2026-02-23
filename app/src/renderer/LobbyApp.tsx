import React, { useEffect, useState } from "react";
import type { CallSession } from "./types";
import { ROOMS } from "./types";

export function LobbyApp() {
  const [apiUrl, setApiUrl] = useState("http://localhost:3000");
  const [workspaceId, setWorkspaceId] = useState("team-local");
  const [displayName, setDisplayName] = useState("Jrod");
  const [selectedRoom, setSelectedRoom] = useState("Team Standup");
  const [status, setStatus] = useState("Pick a room and click Join");

  useEffect(() => {
    window.tandem?.getPendingRoom().then((pending) => {
      if (pending) {
        setSelectedRoom(pending);
      }
    });
    window.tandem?.onDeepLinkRoom((nextRoom) => {
      setSelectedRoom(nextRoom);
      setStatus(`Loaded deep link room ${nextRoom}`);
    });
  }, []);

  async function joinSelectedRoom(): Promise<void> {
    const payload: CallSession = {
      apiUrl: apiUrl.trim(),
      workspaceId: workspaceId.trim(),
      roomId: selectedRoom,
      displayName: displayName.trim() || "Engineer",
      userId: `u-${Math.random().toString(36).slice(2, 8)}`
    };

    try {
      await window.tandem?.openCallWindow(payload);
      setStatus(`Opened call window for ${selectedRoom}`);
    } catch (error) {
      const message = (error as Error).message || "unknown error";
      if (message.includes("No handler registered")) {
        setStatus("Main process is stale; restart the desktop app once.");
      } else {
        setStatus(`Failed to open call: ${message}`);
      }
    }
  }

  return (
    <main className="tandem-shell">
      <header className="topbar">
        <span>Personal Team</span>
      </header>
      <section className="lobby">
        <aside className="rooms-col">
          <div className="rooms-header">
            <span>Rooms</span>
            <button className="small-btn">+</button>
          </div>
          <ul className="rooms-list">
            {ROOMS.map((room) => (
              <li key={room} className={room === selectedRoom ? "active" : ""} onClick={() => setSelectedRoom(room)}>
                <span>🔊</span>
                <span>{room}</span>
                {room === selectedRoom ? (
                  <button className="join-inline" onClick={() => void joinSelectedRoom()}>
                    Join
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </aside>

        <section className="team-col">
          <div className="panel-title">Team</div>
          <div className="member">🟢 {displayName} (you)</div>
          <div className="member">⚪ Jordan</div>
          <button className="primary wide">Invite Teammates</button>
        </section>

        <aside className="details-col">
          <h3>{selectedRoom}</h3>
          <button className="primary wide" onClick={() => void joinSelectedRoom()}>
            Join
          </button>
          <button className="ghost wide">Join w/o audio</button>
          <p className="description">Come here to run your team standup. This panel mirrors Tandem room details.</p>
          <label className="field">
            <span>API URL</span>
            <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          </label>
          <label className="field">
            <span>Workspace ID</span>
            <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
          </label>
          <label className="field">
            <span>Display name</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <p className="status">{status}</p>
        </aside>
      </section>
    </main>
  );
}
