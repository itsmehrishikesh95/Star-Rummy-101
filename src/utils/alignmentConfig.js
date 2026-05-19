/**
 * Centralized Alignment Configuration System
 * Single source of truth for all responsive spacing, sizing, and positioning
 * Used across all game screen components to ensure consistency
 */

export function calculateAlignment(viewportWidth, viewportHeight, isLandscape) {
  // ─────────────────────────────────────────────────────────────
  // PRIMARY BREAKPOINTS
  // ─────────────────────────────────────────────────────────────
  const isShortLandscape = isLandscape && viewportHeight <= 420
  const isIphoneSE = viewportWidth <= 375 || isShortLandscape
  const isStandardPhone = !isIphoneSE && viewportWidth > 375 && viewportWidth <= 430
  const isFoldOrTablet = viewportWidth > 430 && viewportWidth <= 900
  const hasSideScoreboard = viewportWidth >= 980
  const tableCompact = viewportWidth <= 430 || isShortLandscape

  // ─────────────────────────────────────────────────────────────
  // CARD SIZING
  // ─────────────────────────────────────────────────────────────
  const targetCards = 13
  const contentPadding = isIphoneSE ? 10 : isStandardPhone ? 12 : 16
  const scoreboardWidth = hasSideScoreboard ? Math.min(280, Math.max(220, viewportWidth * 0.24)) : 0
  const effectiveHandViewport = Math.max(240, viewportWidth - contentPadding * 2 - scoreboardWidth)
  const rawCardWidth = (effectiveHandViewport / targetCards) * 1.55
  const minCard = isIphoneSE ? 55 : isStandardPhone ? 60 : isFoldOrTablet ? 62 : 75
  const maxCard = isIphoneSE ? 65 : isShortLandscape ? 68 : isStandardPhone ? 70 : isFoldOrTablet ? 74 : 75
  
  function clamp(min, value, max) {
    return Math.min(Math.max(value, min), max)
  }
  
  let cardW = clamp(minCard, rawCardWidth, maxCard)
  let cardH = cardW * (100 / 72)

  // ─────────────────────────────────────────────────────────────
  // BOTTOM POSITIONING & SPACING
  // ─────────────────────────────────────────────────────────────
  const actionBarHeight = tableCompact ? 98 : 108
  const handBottom = actionBarHeight + (isShortLandscape ? 44 : 38)

  // ─────────────────────────────────────────────────────────────
  // CONTROL SIZING
  // ─────────────────────────────────────────────────────────────
  const compactMode = viewportHeight <= 420 || viewportWidth <= 375
  const smallMode = compactMode || viewportWidth <= 430
  const avatarSize = compactMode ? 42 : smallMode ? 52 : 64
  const buttonHeight = compactMode ? 38 : 42
  const buttonMinWidth = compactMode ? 72 : 82
  const buttonPadding = compactMode ? '0 12px' : '0 16px'

  // ─────────────────────────────────────────────────────────────
  // TABLE SIZING
  // ─────────────────────────────────────────────────────────────
  const tableWidth = tableCompact ? 'min(88vw, 520px)' : 'min(92vw, 1180px)'
  const tableHeight = tableCompact ? 'min(56vh, 420px)' : 'min(72vh, 700px)'

  // ─────────────────────────────────────────────────────────────
  // CENTER AREA POSITIONING
  // ─────────────────────────────────────────────────────────────
  const centerAreaTop = isShortLandscape ? '60%' : '62%'

  // ─────────────────────────────────────────────────────────────
  // AI PLAYER POSITIONING (Responsive)
  // ─────────────────────────────────────────────────────────────
  function getAIPositions(tableSize) {
    // Adjust positions based on viewport for landscape
    const topPercentage = isShortLandscape ? '38%' : '42%'
    const sideOffset = isShortLandscape ? 16 : 20

    if (tableSize === 2) {
      return [
        {
          top: isShortLandscape ? '48%' : '52%',
          left: '50%',
          transform: 'translateX(-50%)',
        },
      ]
    }
    if (tableSize === 4) {
      return [
        {
          top: topPercentage,
          left: sideOffset,
          transform: 'translateY(-50%)',
        },
        {
          top: isShortLandscape ? '48%' : '52%',
          left: '50%',
          transform: 'translateX(-50%)',
        },
        {
          top: topPercentage,
          right: sideOffset,
          transform: 'translateY(-50%)',
        },
      ]
    }
    if (tableSize === 6) {
      return [
        {
          // Priya — left side
          top: '72%',
          left: sideOffset,
          transform: 'translateY(-50%)',
        },
        {
          // Rahul — top-left
          top: isShortLandscape ? '52%' : '62%',
          left: '18%',
          transform: 'none',
        },
        {
          // Sneha — top-center
          top: isShortLandscape ? '58%' : '72%',
          left: '50%',
          transform: 'translateX(-50%)',
        },
        {
          // Amit — top-right
          top: isShortLandscape ? '52%' : '62%',
          right: '18%',
          transform: 'none',
        },
        {
          // Kavya — right side
          top: '72%',
          right: sideOffset,
          transform: 'translateY(-50%)',
        },
      ]
    }
    return []
  }

  // ─────────────────────────────────────────────────────────────
  // RETURN ALL CONFIGURATION
  // ─────────────────────────────────────────────────────────────
  return {
    // Breakpoints
    isLandscape,
    isShortLandscape,
    isIphoneSE,
    isStandardPhone,
    isFoldOrTablet,
    hasSideScoreboard,
    tableCompact,
    compactMode,
    smallMode,

    // Card sizing
    cardW,
    cardH,
    contentPadding,
    scoreboardWidth,

    // Spacing
    actionBarHeight,
    handBottom,

    // Control sizing
    avatarSize,
    buttonHeight,
    buttonMinWidth,
    buttonPadding,

    // Table sizing
    tableWidth,
    tableHeight,

    // Positioning
    centerAreaTop,
    getAIPositions,

    // AI seat sizing (used by PlayersAroundTable)
    aiAvatarSz: tableCompact ? 44 : 52,
    aiCardW: tableCompact ? 28 : 36,
    aiCardH: tableCompact ? 38 : 50,
  }
}

/**
 * Helper to extract specific values for a component
 * Reduces prop drilling - components only get what they need
 */
export function getComponentAlignment(alignment, component) {
  const configs = {
    controls: {
      compactMode: alignment.compactMode,
      smallMode: alignment.smallMode,
      avatarSize: alignment.avatarSize,
      buttonHeight: alignment.buttonHeight,
      buttonMinWidth: alignment.buttonMinWidth,
      buttonPadding: alignment.buttonPadding,
    },
    playerHand: {
      cardW: alignment.cardW,
      cardH: alignment.cardH,
      handBottom: alignment.handBottom,
      contentPadding: alignment.contentPadding,
    },
    centerArea: {
      centerAreaTop: alignment.centerAreaTop,
    },
    playersAround: {
      getAIPositions: alignment.getAIPositions,
      isShortLandscape: alignment.isShortLandscape,
      tableCompact: alignment.tableCompact,
    },
    gameTable: {
      tableWidth: alignment.tableWidth,
      tableHeight: alignment.tableHeight,
      tableCompact: alignment.tableCompact,
    },
  }
  return configs[component] || {}
}
