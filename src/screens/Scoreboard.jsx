import React from 'react'

export default function Scoreboard({ players = [], currentTurn = 0, round = 1, winner = null }) {
  return (
    <div
      style={{
        zIndex: 5,
        width: '100%',
        maxWidth: 260,
        background: 'rgba(0,0,0,0.72)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 12,
        padding: 8,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#F5C518', fontWeight: 800 }}>Scoreboard</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>Round {round}</span>
      </div>

      {players.map((player, idx) => {
        const isTurn = currentTurn === idx
        return (
          <div
            key={player.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 6px',
              borderRadius: 8,
              marginBottom: 4,
              border: isTurn ? '1px solid #F5C51855' : '1px solid transparent',
              background: isTurn ? 'rgba(245,197,24,0.12)' : 'rgba(255,255,255,0.03)',
              opacity: player.isEliminated ? 0.6 : 1,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>
                {player.name} {player.isYou ? '(You)' : ''}
              </span>
              <span style={{ fontSize: 9, color: player.isEliminated ? '#ef5350' : 'rgba(255,255,255,0.55)' }}>
                {player.isEliminated ? 'Eliminated' : isTurn ? 'Current turn' : 'Active'}
              </span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: player.score >= 80 ? '#ef5350' : '#F5C518' }}>
              {player.score}
            </span>
          </div>
        )
      })}

      {winner && (
        <div
          style={{
            marginTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.14)',
            paddingTop: 8,
            fontSize: 11,
            color: '#8ef9a9',
            fontWeight: 800,
            textAlign: 'center',
          }}
        >
          Winner: {winner.name}
        </div>
      )}
    </div>
  )
}
