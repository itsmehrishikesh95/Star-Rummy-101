import React from 'react'
import { motion } from 'framer-motion'

export default function TopBar({ playerScore, onBack, onReport }) {
  return (
    <div
      style={{
        width: '100%',
        minHeight: 'calc(56px + env(safe-area-inset-top))',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(8px + env(safe-area-inset-top)) clamp(10px, 2.8vw, 16px) 8px',
        zIndex: 6,
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 14,
        boxShadow: '0 18px 36px rgba(0,0,0,0.32)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <motion.button
          onClick={onBack}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          style={{
            width: 'clamp(36px, 10vw, 44px)',
            height: 'clamp(36px, 10vw, 44px)',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'clamp(16px, 4.5vw, 20px)',
          }}
        >
          ←
        </motion.button>
        <div>
          <div style={{ fontSize: 12, color: '#f8f8ff', fontWeight: 800 }}>Points Rummy</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.64)' }}>Live table · 6 players</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>Balance</span>
          <span style={{ fontSize: 12, color: '#a4ffb5', fontWeight: '800' }}>₹ 226.05</span>
        </div>
        <motion.button
          onClick={onReport}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          style={{
            width: 'clamp(36px, 10vw, 44px)',
            height: 'clamp(36px, 10vw, 44px)',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'clamp(15px, 4vw, 18px)',
          }}
        >
          ⚙
        </motion.button>
      </div>
    </div>
  )
}
