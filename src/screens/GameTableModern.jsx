import React from 'react'

export default function GameTableModern({ compact = false }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {/* ── Outer black rim ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50% / 50%',
          background: '#1a1a1a',
          boxShadow: '0 8px 40px rgba(0,0,0,0.95), inset 0 0 0 3px #0a0a0a',
        }}
      />

      {/* ── Dark leather/rubber rail band ── */}
      <div
        style={{
          position: 'absolute',
          top: '3%',
          left: '1.5%',
          right: '1.5%',
          bottom: '3%',
          borderRadius: '50% / 50%',
          background: 'radial-gradient(ellipse at 50% 50%, #2a2a2a 0%, #111 100%)',
          boxShadow: 'inset 0 0 12px rgba(0,0,0,0.8)',
        }}
      />

      {/* ── Green felt surface ── */}
      <div
        style={{
          position: 'absolute',
          top: '7%',
          left: '3%',
          right: '3%',
          bottom: '7%',
          borderRadius: '50% / 50%',
          background: 'radial-gradient(ellipse at 50% 42%, #3d9c3d 0%, #2e7d2e 50%, #1f5c1f 100%)',
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Inner decorative ring */}
        <div
          style={{
            position: 'absolute',
            top: '8%',
            left: '5%',
            right: '5%',
            bottom: '8%',
            borderRadius: '50% / 50%',
            border: '1px solid rgba(255,255,255,0.06)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}
