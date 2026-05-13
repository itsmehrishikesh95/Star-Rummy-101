import React from "react";

export default function LobbyPlayerSlot({
  name,
  status,
  isBot,
  isEmpty,
  animateJoin,
}) {
  const joinClass = animateJoin ? "bot-join" : "";

  return (
    <div className={["lobby-player", joinClass].filter(Boolean).join(" ")}>
      
      <div className="lobby-avatar">
        {isEmpty ? "" : isBot ? "🤖" : "👤"}
      </div>

      <div>
        <div className="lobby-player-name">
          {isEmpty ? "Waiting for player" : name}
        </div>

        <div className="lobby-player-tag">{status}</div>
      </div>

    </div>
  );
}