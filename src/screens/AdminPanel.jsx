import React, { useState } from 'react'
import { motion } from 'framer-motion'
import useGameStore from '../store'
import useAdminStore from '../store/adminStore'

const C = {
  bg: '#0a0f1a',
  card: '#131d2e',
  border: 'rgba(59,130,246,0.25)',
  gold: '#F5C518',
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef5350',
  muted: 'rgba(148,163,184,0.7)',
  white: '#ffffff',
}

function SliderControl({ label, value, min, max, step = 1, unit = '', onChange }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 6,
      }}>
        <span style={{ color: C.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
          {label}
        </span>
        <span style={{ color: C.gold, fontSize: 14, fontWeight: 900 }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          height: 6,
          borderRadius: 3,
          appearance: 'none',
          background: `linear-gradient(to right, ${C.blue} 0%, ${C.blue} ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 100%)`,
          outline: 'none',
          cursor: 'pointer',
        }}
      />
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3,
      }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

function SelectControl({ label, value, options, onChange }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <span style={{ color: C.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        {options.map(opt => (
          <motion.button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            whileTap={{ scale: 0.95 }}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 10,
              border: `1.5px solid ${value === opt.value ? C.blue : 'rgba(255,255,255,0.1)'}`,
              background: value === opt.value ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
              color: value === opt.value ? C.blue : C.muted,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {opt.label}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function BotNameEditor({ names, onChange }) {
  const [editing, setEditing] = useState(null)
  const [tempName, setTempName] = useState('')

  return (
    <div style={{ marginBottom: 18 }}>
      <span style={{ color: C.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
        BOT NAMES
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {names.map((name, i) => (
          <div key={i} style={{ position: 'relative' }}>
            {editing === i ? (
              <input
                autoFocus
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={() => {
                  if (tempName.trim()) {
                    const updated = [...names]
                    updated[i] = tempName.trim()
                    onChange(updated)
                  }
                  setEditing(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur()
                  if (e.key === 'Escape') setEditing(null)
                }}
                style={{
                  width: 80, padding: '6px 10px', borderRadius: 8,
                  border: `1.5px solid ${C.blue}`,
                  background: 'rgba(59,130,246,0.1)',
                  color: C.white, fontSize: 12, fontWeight: 700,
                  outline: 'none',
                }}
              />
            ) : (
              <motion.button
                onClick={() => { setEditing(i); setTempName(name) }}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: C.white, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {name}
              </motion.button>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
        Tap a name to edit
      </div>
    </div>
  )
}

export default function AdminPanel() {
  const setScreen = useGameStore(s => s.setScreen)
  const {
    botCount, botWinRate, botSpeed, turnTimer, penaltyTimer,
    botDifficulty, botNames, updateConfig, resetConfig,
  } = useAdminStore()

  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontFamily: "'Nunito', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 16px 14px',
        background: 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setScreen('home')}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >‹</button>
        <span style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: 14, fontWeight: 700,
          color: C.gold, letterSpacing: 2,
        }}>⚙️ ADMIN PANEL</span>
        <div style={{ width: 38 }} />
      </div>

      {/* Body — scrollable */}
      <div style={{
        flex: 1, overflow: 'auto',
        padding: '20px 18px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Section: Bot Settings */}
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: '18px 16px', marginBottom: 16,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 900, color: C.blue,
            letterSpacing: 1, marginBottom: 14,
          }}>
            🤖 BOT SETTINGS
          </div>

          <SliderControl
            label="NUMBER OF BOTS"
            value={botCount}
            min={1}
            max={5}
            unit=" bots"
            onChange={(v) => updateConfig('botCount', v)}
          />

          <SliderControl
            label="BOT WIN RATE"
            value={botWinRate}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => updateConfig('botWinRate', v)}
          />

          <SliderControl
            label="BOT SPEED (TURN DELAY)"
            value={botSpeed}
            min={300}
            max={3000}
            step={100}
            unit="ms"
            onChange={(v) => updateConfig('botSpeed', v)}
          />

          <SelectControl
            label="BOT DIFFICULTY"
            value={botDifficulty}
            options={[
              { value: 'easy', label: '😊 Easy' },
              { value: 'medium', label: '🧠 Medium' },
              { value: 'hard', label: '🔥 Hard' },
            ]}
            onChange={(v) => updateConfig('botDifficulty', v)}
          />

          <BotNameEditor
            names={botNames}
            onChange={(v) => updateConfig('botNames', v)}
          />
        </div>

        {/* Section: Timer Settings */}
        <div style={{
          background: C.card, borderRadius: 16,
          border: `1px solid ${C.border}`,
          padding: '18px 16px', marginBottom: 16,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 900, color: C.green,
            letterSpacing: 1, marginBottom: 14,
          }}>
            ⏱️ TIMER SETTINGS
          </div>

          <SliderControl
            label="PLAYER TURN TIME"
            value={turnTimer}
            min={10}
            max={60}
            step={5}
            unit="s"
            onChange={(v) => updateConfig('turnTimer', v)}
          />

          <SliderControl
            label="PENALTY PHASE TIME"
            value={penaltyTimer}
            min={5}
            max={30}
            step={5}
            unit="s"
            onChange={(v) => updateConfig('penaltyTimer', v)}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <motion.button
            onClick={handleSave}
            whileTap={{ scale: 0.95 }}
            style={{
              flex: 1, padding: '14px',
              borderRadius: 12,
              border: `1.5px solid ${C.green}`,
              background: 'rgba(34,197,94,0.12)',
              color: C.green, fontSize: 14, fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {saved ? '✓ Saved!' : '💾 Save Config'}
          </motion.button>

          <motion.button
            onClick={resetConfig}
            whileTap={{ scale: 0.95 }}
            style={{
              flex: 1, padding: '14px',
              borderRadius: 12,
              border: `1.5px solid ${C.red}`,
              background: 'rgba(239,83,80,0.08)',
              color: C.red, fontSize: 14, fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            🔄 Reset Defaults
          </motion.button>
        </div>

        {/* Info */}
        <div style={{
          background: 'rgba(245,197,24,0.06)',
          border: '1px solid rgba(245,197,24,0.2)',
          borderRadius: 12, padding: '12px 14px',
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 4 }}>
            ℹ️ How it works
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
            Changes apply to the <strong style={{ color: C.white }}>next game</strong> you start.
            Bot count, speed, difficulty, and win rate will be used when starting practice mode.
            Timer settings affect both practice and multiplayer games.
          </div>
        </div>
      </div>
    </div>
  )
}
