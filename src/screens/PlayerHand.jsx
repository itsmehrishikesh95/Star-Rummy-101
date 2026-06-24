import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getCardImage } from '../utils/cardImage'
import { motion } from 'framer-motion'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
function asArray(v) { return Array.isArray(v) ? v : [] }
function clamp(min, v, max) { return Math.min(Math.max(v, min), max) }

// ── Card face: uses new 52_cards_png images ──
function CardFace({ card, selected = false, style = {}, onClick, width = 72, height = 100 }) {
  if (!card) return null
  const isJokerCard = card.isWildJoker || card.isJoker
  return (
    <div
      onClick={onClick}
      style={{
        width: '100%', height: '100%',
        borderRadius: 6,
        border: isJokerCard ? '2px solid #FFD700' : 'none',
        boxShadow: selected
          ? '0 0 0 2px rgba(255,255,255,0.8), 0 6px 18px rgba(0,0,0,0.45)'
          : '0 4px 12px rgba(0,0,0,0.3)',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        ...style,
      }}
    >
      <img
        src={getCardImage(card.rank, card.suit)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 4 }}
        draggable={false}
      />
    </div>
  )
}

// ── Group evaluation ──
function evalGroup(group) {
  const g = asArray(group).filter(Boolean)
  if (!g.length) return { label: 'Empty', color: '#555', pts: 0, valid: false }
  const jokers = g.filter(c => c.isJoker || c.isWildJoker)
  const nat = g.filter(c => !c.isJoker && !c.isWildJoker)
  const pts = nat.reduce((s, c) => s + (c.pts || 0), 0)

  if (!jokers.length && nat.length >= 3) {
    const ss = nat.every(c => c.suit === nat[0].suit)
    if (ss) {
      const idx = nat.map(c => RANKS.indexOf(c.rank)).sort((a, b) => a - b)
      if (idx.every((v, i) => i === 0 || v === idx[i - 1] + 1))
        return { label: 'Pure Seq', color: '#1565c0', pts: 0, valid: true, type: 'pureSeq' }
    }
  }
  if (nat.length >= 2) {
    const ss = nat.every(c => c.suit === nat[0].suit)
    if (ss) {
      const idx = nat.map(c => RANKS.indexOf(c.rank)).sort((a, b) => a - b)
      const gaps = idx.reduce((a, v, i) => i === 0 ? 0 : a + (v - idx[i - 1] - 1), 0)
      if (gaps <= jokers.length && nat.length + jokers.length >= 3)
        return { label: 'Sequence', color: '#2e7d32', pts: 0, valid: true, type: 'seq' }
    }
    const sr = nat.every(c => c.rank === nat[0].rank)
    const us = new Set(nat.map(c => c.suit)).size
    const tot = nat.length + jokers.length
    if (sr && us === nat.length && tot >= 3 && tot <= 4)
      return { label: 'Set', color: '#2e7d32', pts: 0, valid: true, type: 'set' }
  }
  return { label: `${pts}pts`, color: '#c62828', pts, valid: false, type: 'invalid' }
}

function getHandGroups(hand) {
  const cards = asArray(hand).filter(Boolean)
  if (!cards.length) return [[]]
  const bySuit = {}
  cards.forEach(c => {
    const key = c.isJoker || c.isWildJoker ? 'joker' : c.suit
    if (!bySuit[key]) bySuit[key] = []
    bySuit[key].push(c)
  })
  Object.keys(bySuit).forEach(s => {
    if (s !== 'joker') bySuit[s].sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank))
  })
  return Object.values(bySuit).filter(g => g.length > 0)
}

// ── Sortable card ──
function SortableCard({ card, selected, cardW, cardH, onClick, idx, overlapOffset }) {
  if (card?.id == null) return null
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const ts = CSS.Transform.toString({ ...transform, scaleX: transform?.scaleX ?? 1, scaleY: transform?.scaleY ?? 1 })

  // Tap detection via pointer tracking — works on all devices including Oppo/Vivo
  const pointerStartRef = useRef(null)

  const handlePointerDown = (e) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const handlePointerUp = (e) => {
    if (!pointerStartRef.current) return
    const dx = Math.abs(e.clientX - pointerStartRef.current.x)
    const dy = Math.abs(e.clientY - pointerStartRef.current.y)
    pointerStartRef.current = null
    // If pointer moved less than 8px total, treat as tap
    if (dx < 8 && dy < 8 && onClick) {
      onClick()
    }
  }

  // Extra touch padding around each card (increases touch target without changing card size)
  const touchPadX = 8
  const touchPadY = 12

  return (
    <div
      ref={setNodeRef}
      data-card-id={card.id}
      {...attributes}
      {...Object.fromEntries(Object.entries(listeners ?? {}).filter(([k]) => k !== 'onPointerDown'))}
      onPointerDown={(e) => {
        listeners?.onPointerDown?.(e);
        handlePointerDown(e);
      }}
      onPointerUp={handlePointerUp}
      style={{
        width: cardW + touchPadX * 2,
        height: cardH + touchPadY * 2,
        padding: `${touchPadY}px ${touchPadX}px`,
        boxSizing: 'border-box',
        flexShrink: 0,
        position: 'relative',
        marginLeft: idx === 0 ? -touchPadX : -(overlapOffset + touchPadX * 2 - touchPadX),
        marginTop: -touchPadY,
        marginBottom: -touchPadY,
        zIndex: isDragging ? 9999 : selected ? 50 : idx + 1,
        opacity: isDragging ? 0.85 : 1,
        transform: ts || undefined,
        transition,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <motion.div
        animate={
          isDragging ? { y: -10, scale: 1.06 }
          : selected ? { y: -18, scale: 1.03 }
          : { y: 0, scale: 1 }
        }
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: cardW, height: cardH, borderRadius: 7 }}
      >
        <CardFace card={card} selected={selected} width={cardW} height={cardH} />
      </motion.div>
    </div>
  )
}


// ── Group drop zone ──
function GroupDropZone({ group, groupIndex, cardW, cardH, selectedCardId, selectedCardIds = [], onCardSelect }) {
  const safe = asArray(group).filter(Boolean)
  const { setNodeRef, isOver } = useDroppable({ id: `group-${groupIndex}`, data: { groupIndex } })
  const ev = evalGroup(safe)

  // Cards within a group overlap — show ~50% of each card (enough spacing to tap adjacent cards)
  const overlapOffset = Math.round(cardW * 0.50)

  // Total visual width of the group for the container
  const groupVisualWidth = safe.length > 0
    ? cardW + (safe.length - 1) * (cardW - overlapOffset)
    : cardW

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
      <motion.div
        ref={setNodeRef}
        animate={{ scale: isOver ? 1.03 : 1, y: isOver ? -4 : 0 }}
        transition={{ duration: 0.18 }}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0,
          padding: '28px 6px 4px',
          borderRadius: 9,
          background: 'transparent',
          border: '1.5px solid transparent',
          minHeight: cardH + 36,
          minWidth: safe.length > 0 ? groupVisualWidth + 12 : cardW + 12,
          overflow: 'visible',
        }}
      >
        {safe.length === 0 ? (
          <div style={{
            width: cardW, height: cardH, borderRadius: 7,
            border: '1.5px dashed rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.3)', fontSize: 10,
          }}>+</div>
        ) : (
          safe.map((card, i) => (
            <SortableCard
              key={card.id} card={card} idx={i}
              cardW={cardW} cardH={cardH}
              overlapOffset={overlapOffset}
              selected={selectedCardId === card.id || selectedCardIds.includes(card.id)}
              onClick={() => onCardSelect(card)}
            />
          ))
        )}
      </motion.div>

      {/* Group label — shows Pure Seq, Sequence, Set, or points */}
      {safe.length > 0 && (
        <div style={{
          padding: '1px 7px', borderRadius: 999,
          background: ev.valid ? 'rgba(34,197,94,0.15)' : 'rgba(239,83,80,0.12)',
          border: `1.5px solid ${ev.valid ? 'rgba(34,197,94,0.4)' : 'rgba(239,83,80,0.35)'}`,
          minWidth: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            color: ev.valid ? '#22c55e' : '#ef5350',
            fontSize: 8, fontWeight: 800, whiteSpace: 'nowrap',
          }}>
            {ev.label}
          </span>
        </div>
      )}
    </div>
  )
}

export default function PlayerHand({
  playerHand,
  selectedCard,
  selectedCards = [],
  cardW,
  cardH,
  handRef,
  sortRef,
  onCardSelect,
  onHandMouseDown,
  onHandMouseMove,
  onHandTouchStart,
  onHandTouchMove,
  canInteract = true,
  canDiscard = false,
  discardPileRef = null,
  onDiscard = null,
  viewportWidth = 1200,
  viewportHeight = 800,
}) {
  // Cards start in ONE flat group — user must press Sort to group them
  const [handGroups, setHandGroups] = useState(() => {
    const cards = asArray(playerHand).filter(Boolean)
    return cards.length > 0 ? [cards] : [[]]
  })

  // Expose setHandGroups to parent via sortRef so Sort can directly update groups
  useEffect(() => {
    if (sortRef) sortRef.current = setHandGroups
  }, [sortRef])
  const [activeId, setActiveId] = useState(null)
  const [handWidth, setHandWidth] = useState(0)
  const prevFlatIdsRef = useRef('')

  // When playerHand changes externally (deal/draw/discard), preserve group structure.
  // Do NOT auto-sort or auto-group — that only happens when Sort is pressed.
  useEffect(() => {
    const newCards = asArray(playerHand).filter(Boolean)
    const newIdSet = new Set(newCards.map(c => c.id))
    const newIds = [...newIdSet].sort().join(',')
    
    // Use sorted IDs for comparison — order changes (from sort) should NOT trigger regrouping
    const prevIds = prevFlatIdsRef.current
    if (newIds === prevIds) return
    prevFlatIdsRef.current = newIds

    const newCardMap = new Map(newCards.map(c => [c.id, c]))

    setHandGroups(prev => {
      // Check if it's just a reorder (same cards, different order) — preserve groups
      const existingIds = new Set(prev.flat().filter(Boolean).map(c => c.id))
      const sameCards = newCards.length === existingIds.size && newCards.every(c => existingIds.has(c.id))
      if (sameCards && prev.flat().length === newCards.length) {
        // Same cards, just update references in existing groups
        return prev.map(g => g.map(c => newCardMap.get(c.id)).filter(Boolean)).filter(g => g.length > 0)
      }

      // Remove discarded cards, update existing cards in place
      const updated = prev
        .map(g => g.filter(c => newCardMap.has(c.id)).map(c => newCardMap.get(c.id)))
        .filter(g => g.length > 0)

      // Find newly added cards not yet in any group
      const updatedIds = new Set(updated.flat().map(c => c.id))
      const added = newCards.filter(c => !updatedIds.has(c.id))

      if (added.length > 0) {
        if (updated.length === 0) return [added]
        // Append new cards to the last group
        return [...updated.slice(0, -1), [...updated[updated.length - 1], ...added]]
      }

      return updated.length > 0 ? updated : [[]]
    })
  }, [playerHand])

  const safeGroups = useMemo(() => {
    const g = asArray(handGroups)
    return g.length > 0 ? g.map(x => asArray(x)) : [[]]
  }, [handGroups])

  const flatHand = useMemo(() => safeGroups.flat().filter(Boolean), [safeGroups])
  const sortableIds = useMemo(() => flatHand.filter(c => c?.id != null).map(c => c.id), [flatHand])

  const sensors = useSensors(
    // Mouse: activate after 8px movement
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
    // Touch: activate after 10px movement — no time delay (Oppo/Vivo cancel delayed touches)
    useSensor(TouchSensor, {
      activationConstraint: { distance: 10 },
    })
  )
  const activeCard = flatHand.find(c => c.id === activeId)

  // Use strict fixed dimensions passed from GameScreen for 100% consistency
  const fW = cardW
  const fH = cardH

  useEffect(() => {
    if (!handRef?.current) return
    const node = handRef.current
    const update = () => setHandWidth(node.getBoundingClientRect().width || 0)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    window.addEventListener('resize', update)
    return () => { ro.disconnect(); window.removeEventListener('resize', update) }
  }, [handRef])

  // Fit all cards in available width by adjusting ONLY the gap
  const gap = useMemo(() => {
    const avail = Math.max((handWidth || viewportWidth) - 32, 180)
    const totalCards = Math.max(flatHand.length, 1)
    const groupCount = safeGroups.length
    const groupGap = 8
    const totalGroupGaps = (groupCount - 1) * groupGap
    const perGroupPad = groupCount * 10
    
    // Space remaining for all cards minus gaps and padding
    const spaceForCards = avail - totalGroupGaps - perGroupPad
    
    // Default gap is 6. If cards don't fit, we overlap them more (lower gap or negative gap)
    // Total width needed = (totalCards * fW) + ((totalCards - groupCount) * gap)
    // We want: spaceForCards >= (totalCards * fW) + ((totalCards - groupCount) * targetGap)
    // targetGap = (spaceForCards - (totalCards * fW)) / Math.max(1, totalCards - groupCount)
    
    const neededGap = (spaceForCards - (totalCards * fW)) / Math.max(1, totalCards - groupCount)
    return clamp(-fW + 10, neededGap, -16)
  }, [handWidth, viewportWidth, flatHand.length, safeGroups.length, fW])

  function handleDragStart({ active }) {
    if (canInteract) {
      onCardSelect(null)  // clear all selections when drag begins
      setActiveId(active.id)
    }
  }
  function handleDragCancel() { setActiveId(null) }
  function handleDragEnd({ active, over, delta }) {
    if (!canInteract) { setActiveId(null); return }
    setActiveId(null)

    // ── If card dragged away from hand area → auto-discard ──
    // delta.y < -40 (dragged up) OR significant movement away from hand
    const draggedFarUp = delta && delta.y < -40
    const draggedFarAway = delta && (Math.abs(delta.x) > 120 || Math.abs(delta.y) > 50)
    
    if ((draggedFarUp || draggedFarAway) && onDiscard) {
      const draggedCard = flatHand.find(c => c.id === active.id)
      if (draggedCard) {
        onCardSelect(draggedCard)
        onDiscard(draggedCard)
      }
      return
    }

    // ── Drop outside any valid target → auto-discard if allowed ──
    if (!over) {
      if (onDiscard) {
        const draggedCard = flatHand.find(c => c.id === active.id)
        if (draggedCard) {
          onCardSelect(draggedCard)
          onDiscard(draggedCard)
        }
      }
      return
    }

    // ── Drop on discard pile → discard ──
    if (over.id === 'discard-pile') {
      const draggedCard = flatHand.find(c => c.id === active.id)
      if (draggedCard && onDiscard) {
        onCardSelect(draggedCard)
        onDiscard(draggedCard)
      }
      return
    }

    // ── Drop on another card or group → reorder freely ──
    if (active.id === over.id) return
    const srcGi = safeGroups.findIndex(g => g.some(c => c.id === active.id))
    if (srcGi === -1) return
    const srcIdx = safeGroups[srcGi].findIndex(c => c.id === active.id)
    if (srcIdx === -1) return
    const moved = safeGroups[srcGi][srcIdx]
    const next = safeGroups.map(g => [...g])
    next[srcGi].splice(srcIdx, 1)
    if (over.data.current?.groupIndex !== undefined) {
      next[over.data.current.groupIndex]?.push(moved)
    } else {
      const tgi = safeGroups.findIndex(g => g.some(c => c.id === over.id))
      if (tgi === -1) return
      const ti = next[tgi].findIndex(c => c.id === over.id)
      const adj = srcGi === tgi && srcIdx < ti ? Math.max(0, ti - 1) : ti
      next[tgi].splice(adj, 0, moved)
    }
    // Remove empty groups after moving cards
    const cleaned = next.filter(g => g.length > 0)
    setHandGroups(cleaned.length > 0 ? cleaned : [[]])
  }

  const handContent = (
    <div
      ref={handRef}
      onMouseDown={onHandMouseDown}
      onMouseMove={onHandMouseMove}
      onTouchStart={onHandTouchStart}
      onTouchMove={onHandTouchMove}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
        padding: '28px 8px 0',
        justifyContent: 'center',
        overflow: 'visible',
        WebkitOverflowScrolling: 'touch',
        position: 'relative',
        touchAction: 'none',
      }}
    >
      {safeGroups.map((group, gi) => (
        <GroupDropZone
          key={`g-${gi}`}
          group={group}
          groupIndex={gi}
          cardW={fW}
          cardH={fH}
          selectedCardId={selectedCard?.id}
          selectedCardIds={selectedCards.map(c => c.id)}
          onCardSelect={card => canInteract && onCardSelect(card)}
        />
      ))}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 2, paddingTop: 6, overflow: 'visible', position: 'relative', zIndex: activeId ? 9999 : 'auto' }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        {canInteract && sortableIds.length > 0 ? (
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            {handContent}
          </SortableContext>
        ) : handContent}

      </DndContext>
    </div>
  )
}
