import React from 'react'
import { motion } from 'framer-motion'

function pillStyle(enabled, palette, { height = 42, minWidth = 92, padding = '0 18px' } = {}) {
  return {
    minWidth: minWidth * 0.75,
    height: height * 0.8,
    padding: '0 10px',
    borderRadius: 999,
    border: `2px solid ${enabled ? palette.border : 'rgba(255,255,255,0.1)'}`,
    background: enabled ? palette.bg : 'rgba(255,255,255,0.05)',
    color: enabled ? palette.color : 'rgba(255,255,255,0.3)',
    fontWeight: 800,
    fontSize: 11,
    cursor: enabled ? 'pointer' : 'not-allowed',
    boxShadow: enabled ? palette.shadow : '0 4px 12px rgba(0,0,0,0.3)',
    opacity: enabled ? 1 : 0.4,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(8px)',
    textTransform: 'capitalize',
    transform: enabled ? 'translateY(0)' : 'translateY(0)',
    filter: enabled ? 'brightness(1)' : 'brightness(0.6) grayscale(0.3)',
  }
}

export default function Controls({
  playerScore,
  gameState,
  selectedCard,
  hasDrawn,
  declaration,
  onDeclare,
  onDropGame,
  onSort,
  onGroup,
  onDiscard,
  isPlayerTurn,
  canDropMove = false,
  canSortMove = false,
  canGroupMove = false,
  canDiscardMove = false,
  canDeclareMove = false,
  viewportWidth = 375,
  viewportHeight = 800,
  compactMode = false,
  smallMode = false,
  avatarSize = 52,
  buttonHeight = 42,
  buttonMinWidth = 82,
  buttonPadding = '0 18px',
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '5px',
        zIndex: 15,
        pointerEvents: 'auto',
      }}
    >
      <motion.button
        onClick={onSort}
        disabled={!canSortMove}
        whileHover={canSortMove ? { scale: 1.05, y: -2 } : { scale: 1 }}
        whileTap={canSortMove ? { scale: 0.92 } : { scale: 0.98 }}
        style={pillStyle(canSortMove, {
          border: 'rgba(68,114,255,0.78)',
          bg: 'linear-gradient(180deg, rgba(46,75,184,0.96), rgba(26,45,116,0.96))',
          color: '#ecf1ff',
          shadow: '0 4px 10px rgba(25,43,117,0.42)',
        }, { minWidth: buttonMinWidth, height: buttonHeight, padding: buttonPadding })}
      >
        Sort
      </motion.button>

      <motion.button
        onClick={onGroup}
        disabled={!canGroupMove}
        whileHover={canGroupMove ? { scale: 1.05, y: -2 } : { scale: 1 }}
        whileTap={canGroupMove ? { scale: 0.92 } : { scale: 0.98 }}
        style={pillStyle(canGroupMove, {
          border: 'rgba(168,85,247,0.78)',
          bg: 'linear-gradient(180deg, rgba(109,40,217,0.96), rgba(76,29,149,0.96))',
          color: '#f3e8ff',
          shadow: '0 4px 10px rgba(109,40,217,0.42)',
        }, { minWidth: buttonMinWidth, height: buttonHeight, padding: buttonPadding })}
      >
        Group
      </motion.button>

      <motion.button
        onClick={onDropGame}
        disabled={!canDropMove}
        whileHover={canDropMove ? { scale: 1.05, y: -2 } : { scale: 1 }}
        whileTap={canDropMove ? { scale: 0.92 } : { scale: 0.98 }}
        style={pillStyle(canDropMove, {
          border: 'rgba(53,184,82,0.76)',
          bg: 'linear-gradient(180deg, rgba(18,111,34,0.96), rgba(10,76,23,0.96))',
          color: '#ebffef',
          shadow: '0 4px 10px rgba(10,76,23,0.42)',
        }, { minWidth: buttonMinWidth, height: buttonHeight, padding: buttonPadding })}
      >
        Drop
      </motion.button>

      <motion.button
        onClick={onDiscard}
        disabled={!canDiscardMove}
        whileHover={canDiscardMove ? { scale: 1.05, y: -2 } : { scale: 1 }}
        whileTap={canDiscardMove ? { scale: 0.92 } : { scale: 0.98 }}
        style={pillStyle(canDiscardMove, {
          border: 'rgba(255,177,66,0.82)',
          bg: 'linear-gradient(180deg, rgba(186,113,22,0.95), rgba(126,71,8,0.95))',
          color: '#fff8e8',
          shadow: '0 4px 10px rgba(120,73,16,0.42)',
        }, { minWidth: buttonMinWidth, height: buttonHeight, padding: buttonPadding })}
      >
        Discard
      </motion.button>

      <motion.button
        onClick={onDeclare}
        disabled={!canDeclareMove}
        whileHover={canDeclareMove ? { scale: 1.05, y: -2 } : { scale: 1 }}
        whileTap={canDeclareMove ? { scale: 0.92 } : { scale: 0.98 }}
        style={pillStyle(canDeclareMove, {
          border: 'rgba(239,83,80,0.75)',
          bg: 'linear-gradient(180deg, rgba(157,25,25,0.94), rgba(108,10,10,0.94))',
          color: '#fff6f6',
          shadow: '0 4px 10px rgba(120,11,11,0.42)',
        }, { minWidth: buttonMinWidth, height: buttonHeight, padding: buttonPadding })}
      >
        Declare
      </motion.button>
    </div>
  )
}
