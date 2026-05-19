import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getCardImage } from '../utils/cardImage'
import { motion } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
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

import jokerHatImg from '../assets/Joker_hat.png'

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
        boxShadow: isJokerCard
          ? '0 0 0 2px #FFD700, 0 0 8px 2px rgba(255,215,0,0.55), 0 4px 12px rgba(0,0,0,0.3)'
          : selected
            ? '0 0 0 2.5px #F5C518, 0 6px 18px rgba(0,0,0,0.45)'
            : '0 4px 12px rgba(0,0,0,0.3)',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        overflow: 'visible',
        flexShrink: 0,
        position: 'relative',
        ...style,
      }}
    >
      <div style={{ width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden' }}>
        <img
          src={getCardImage(card.rank, card.suit)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 6 }}
          draggable={false}
        />
      </div>
      {isJokerCard && (
        <img
          src={jokerHatImg}
          draggable={false}
          style={{
            position: 'absolute',
            top: -52,
            left: -40,
            width: Math.round(width * 0.95),
            height: 'auto',
            pointerEvents: 'none',
            zIndex: 10,
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))',
          }}
        />
      )}
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

  return (
    <div
      ref={setNodeRef}
      data-card-id={card.id}
      {...attributes}
      {...listeners}
      style={{
        width: cardW,
        height: cardH,
        flexShrink: 0,
        position: 'relative',
        marginLeft: idx === 0 ? 0 : -overlapOffset,
        zIndex: isDragging ? 60 : selected ? 50 : idx + 1,
        opacity: isDragging ? 0.85 : 1,
        transform: ts || undefined,
        transition,
        touchAction: 'none',   // critical: lets dnd-kit own all touch events
        userSelect: 'none',
      }}
    >
      <motion.div
        animate={
          isDragging ? { y: -10, scale: 1.06 }
          : selected ? { y: -18, scale: 1.03 }
          : { y: 0, scale: 1 }
        }
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: '100%', height: '100%', borderRadius: 7 }}
      >
        <CardFace card={card} selected={selected} onClick={onClick} width={cardW} height={cardH} />
      </motion.div>
    </div>
  )
}

// ── Discard drop zone — fixed overlay over the discard pile, visible while dragging ──
function DiscardDropZone({ discardRef, canDiscard, isDragging: anyDragging }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'discard-pile' })

  const [rect, setRect] = useState(null)
  useEffect(() => {
    if (!discardRef?.current) return
    const update = () => {
      const r = discardRef.current?.getBoundingClientRect()
      if (r) setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [discardRef, anyDragging])

  if (!rect || !anyDragging || !canDiscard) return null

  const pad = 24
  return (
    <>
      {/* Actual droppable hit area — must have pointer-events so dnd-kit can detect it */}
      <div
        ref={setNodeRef}
        style={{
          position: 'fixed',
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          zIndex: 9997,
          borderRadius: 12,
          // transparent but pointer-events enabled so dnd-kit collision works
          background: 'transparent',
          pointerEvents: 'all',
        }}
      />
      {/* Visual highlight — purely decorative, no pointer events */}
      <div
        style={{
          position: 'fixed',
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          zIndex: 9998,
          borderRadius: 12,
          border: isOver ? '2.5px solid #F5C518' : '2px dashed rgba(245,197,24,0.55)',
          background: isOver ? 'rgba(245,197,24,0.2)' : 'rgba(245,197,24,0.07)',
          pointerEvents: 'none',
          transition: 'all 0.15s ease',
        }}
      />
    </>
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
          // No gap — overlap is handled by negative marginLeft on cards
          gap: 0,
          padding: '28px 6px 4px',  // extra top padding so lifted/selected cards don't clip
          borderRadius: 9,
          background: isOver ? 'rgba(245,197,24,0.12)' : 'transparent',
          border: `1.5px ${isOver ? 'solid' : 'dashed'} ${isOver ? 'rgba(245,197,24,0.65)' : 'transparent'}`,
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

      {/* Group label */}
      <div style={{
        padding: '1px 7px', borderRadius: 999,
        background: ev.valid ? `${ev.color}28` : `${ev.color}38`,
        border: `1.5px solid ${ev.color}60`,
        minWidth: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          color: ev.valid ? ev.color : '#fff',
          fontSize: 8, fontWeight: 800, whiteSpace: 'nowrap',
          textShadow: ev.valid ? 'none' : '0 1px 3px rgba(0,0,0,0.7)',
        }}>
          {ev.label}
        </span>
      </div>
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
    const newIds = asArray(playerHand).filter(Boolean).map(c => c.id).join(',')
    if (newIds === prevFlatIdsRef.current) return
    prevFlatIdsRef.current = newIds

    const newCards = asArray(playerHand).filter(Boolean)
    const newCardMap = new Map(newCards.map(c => [c.id, c]))

    setHandGroups(prev => {
      // Remove discarded cards, update existing cards in place
      const updated = prev
        .map(g => g.filter(c => newCardMap.has(c.id)).map(c => newCardMap.get(c.id)))
        .filter(g => g.length > 0)

      // Find newly added cards not yet in any group
      const existingIds = new Set(updated.flat().map(c => c.id))
      const added = newCards.filter(c => !existingIds.has(c.id))

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
      activationConstraint: { distance: 8 },
    }),
    // Touch: activate after 200ms hold OR 8px movement — prevents conflict with taps
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
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

  function handleDragStart({ active }) { if (canInteract) setActiveId(active.id) }
  function handleDragCancel() { setActiveId(null) }
  function handleDragEnd({ active, over }) {
    if (!canInteract) { setActiveId(null); return }
    setActiveId(null)
    if (!over) return

    // ── Drop on discard pile → select that card and discard it ──
    if (over.id === 'discard-pile') {
      const draggedCard = flatHand.find(c => c.id === active.id)
      if (draggedCard && canDiscard && onDiscard) {
        onCardSelect(draggedCard)   // mark it selected visually
        onDiscard(draggedCard)      // pass card directly so discard doesn't need state to settle
      }
      return
    }

    // ── Drop on another card or group → reorder ──
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
    setHandGroups(next)
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 2, paddingTop: 6, overflow: 'visible', position: 'relative' }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        {/* Invisible drop zone over the discard pile — shown while dragging */}
        <DiscardDropZone
          discardRef={discardPileRef}
          canDiscard={canDiscard}
          isDragging={!!activeId}
        />

        {canInteract && sortableIds.length > 0 ? (
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            {handContent}
          </SortableContext>
        ) : handContent}

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeCard ? (
            <CardFace
              card={activeCard}
              selected={selectedCard?.id === activeCard.id}
              style={{ width: fW, height: fH, boxShadow: '0 18px 36px rgba(0,0,0,0.5)', transform: 'rotate(2deg)' }}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
