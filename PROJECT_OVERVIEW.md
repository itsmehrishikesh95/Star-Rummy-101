# Star Rummy 101 Pool — Complete Project Overview

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 |
| State Management | Zustand 4.5 |
| Animations | Framer Motion 11 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Backend | Express 5 + Socket.IO 4.8 |
| Auth | Firebase 9 (Phone OTP + Guest login) |
| Native | Capacitor 8 (Android) |
| Hosting | Railway (backend), GitHub Pages (frontend) |

---

## Project Structure

```
src/
├── App.jsx                    # Root component, screen-based routing via Zustand
├── firebase.js                # Firebase Auth initialization
├── store.js                   # Main Zustand store (navigation, user, game state)
├── store/
│   └── adminStore.js          # Admin config store (bot settings, timers) — localStorage
├── screens/
│   ├── SplashScreen.jsx       # Animated loading → Login
│   ├── Login.jsx              # Phone OTP + Guest login
│   ├── MainMenu.jsx           # Hub: Practice, Private Room, Join, Profile, Admin
│   ├── PracticeModeScreen.jsx # Choose 2P or 6P table (solo vs bots)
│   ├── PrivateRoomScreen.jsx  # Create room + JoinRoomScreen (enter code)
│   ├── RoomCodeScreen.jsx     # Display room code, copy, enter lobby
│   ├── MatchLobbyScreen.jsx   # Real-time player list, bot fill, countdown, start
│   ├── SubscriptionScreen.jsx # Subscription flow for private rooms
│   ├── ProfileScreen.jsx      # Avatar, name, gender, email
│   ├── AdminPanel.jsx         # Bot count, win rate, speed, difficulty, timers
│   ├── GameScreen.jsx         # THE MAIN GAME (~2800 lines)
│   ├── PlayerHand.jsx         # Drag-sortable card groups with evaluation labels
│   ├── PlayersAroundTable.jsx # AI seats with timer rings, action badges
│   ├── CenterArea.jsx        # Draw pile, discard pile, finish slot, wild joker
│   ├── Controls.jsx           # Sort, Group, Drop, Discard, Declare buttons
│   ├── Scoreboard.jsx         # Score tracking, elimination status
│   ├── TopBar.jsx             # Game header (back, balance, label)
│   ├── AnimationLayer.jsx     # Flying card animation system
│   └── RummyCardAnimations.jsx # CSS keyframe definitions
├── services/
│   ├── socket.js              # Singleton Socket.IO client service
│   └── gameSocket.js          # Multiplayer event emitters + subscriber
├── game/
│   └── engine.js              # Standalone rummy engine (validation, AI, deck)
├── utils/
│   ├── cardImage.js           # Maps rank+suit to PNG image URLs
│   └── alignmentConfig.js     # Responsive layout calculator
└── assets/
    ├── 52_cards_png/          # Card face images (S2.png, HA.png, etc.)
    ├── NEWGAMETABLE.png       # Game table background
    ├── Star_Rummy_card.png    # Card back image
    └── Joker_hat.png          # Joker indicator image

server.js                      # Express + Socket.IO multiplayer server
capacitor.config.json          # Capacitor native config (Android)
```

---

## Navigation Flow

```
SplashScreen → Login (OTP or Guest)
                    ↓
              MainMenu (home)
              ├── Practice Mode → PracticeModeScreen (2P/6P) → GameScreen (solo)
              ├── Create Private Room → SubscriptionScreen → RoomCodeScreen → MatchLobbyScreen → GameScreen (multiplayer)
              ├── Join with Code → JoinRoomScreen → MatchLobbyScreen → GameScreen (multiplayer)
              ├── Profile → ProfileScreen
              └── Admin (⚙️) → AdminPanel
```

Navigation is managed by Zustand `screen` state — no React Router. `App.jsx` renders the appropriate component based on `screen` value.

---

## Authentication (Login.jsx)

- **Phone OTP**: Firebase Auth with `signInWithPhoneNumber` (India +91 only)
  - RecaptchaVerifier created on user action (not on mount)
  - Token stored in `localStorage` as `firebase_id_token`
  - 30-second resend cooldown
- **Guest Login**: Generates unique guest ID, gives 5000 starting coins
  - Stored in localStorage as `guestUser`
  - Guest users cannot create private rooms
- **Session Restore**: On app load, checks localStorage for existing token/guest data

---

## Game Rules (101 Pool Rummy)

### Setup
- 2–6 players (1 human + 1–5 bots in practice mode)
- 1 deck for <5 players, 2 decks for 5+ players
- 13 cards dealt to each player
- Wild joker: random card selected — all cards of same rank become wild jokers
- No printed jokers in this implementation (only wild jokers)

### Card Values
- A, J, Q, K, 10 = 10 points each
- 2–9 = face value
- Jokers (wild) = 0 points

### Turn Flow
1. **Draw phase**: Player MUST draw from either closed deck or open discard pile
2. **Discard phase**: Player MUST discard one card to the discard pile
3. Turn passes to next player (clockwise)

### Valid Groups (melds)
- **Pure Sequence**: 3+ consecutive same-suit cards, NO printed jokers (wild jokers used as natural card ARE allowed)
- **Impure Sequence**: 3+ same-suit cards with jokers filling gaps
- **Set**: 3–4 same-rank cards of different suits (jokers allowed)

### Declaration
- Player must have drawn (14 cards) → selects a card to discard to "Finish Slot"
- Remaining 13 cards must form valid groups with:
  - At least 1 Pure Sequence
  - At least 2 total Sequences (pure + impure)
  - ALL groups must be valid
- **Valid declaration**: Declarer scores 0, all others score their unmatched card points (max 80)
- **Wrong show (invalid)**: Declarer scores 80, others score their actual hand value

### Scoring & Elimination
- Scores accumulate across rounds
- Player eliminated when score reaches ≥101 points
- Game ends when only 1 player remains (winner)
- Score cap per round: 80 points maximum

### Drop
- **First drop** (before drawing): +20 points penalty
- **Middle drop** (after drawing): +40 points penalty
- Dropped player sits out rest of the round but stays in the game

### Timer
- Main phase: configurable (default 30s) — green countdown ring
- Penalty phase: configurable (default 10s) — red countdown ring
- Auto-discard: if timer expires, auto-draws (if needed) then discards highest-point invalid card

---

## GameScreen.jsx — Core Game Logic

### State Machine
```
'dealing' → 'draw' → 'discard' → 'finished'
     ↑___________________________|  (next round)
```

### Initialization (Solo Mode)
1. Reads admin config for bot count, names, speed
2. Creates deck(s), shuffles, deals 13 cards each
3. Selects wild joker (random card — all same rank become wild)
4. Plays deal animation (cards fly from deck to hand one-by-one)
5. Random toss determines first player
6. Starts turn engine

### Turn Engine (Centralized)
```javascript
turnEngine = {
  startTurn(playerIndex)      // Set current turn, reset timer, trigger AI if bot
  advanceTurnOnce(reason)     // Skip eliminated/dropped, wrap around table
  playAITurn(aiIndex)         // AI draw animation → wait → AI discard
  doAiDiscard(aiIndex, hand)  // Smart/dumb discard based on win rate + difficulty
}
```

### AI Behavior
- **Draw**: Always from closed deck (no strategic discard pile pickup)
- **Discard Intelligence** (controlled by admin win rate + difficulty):
  - Smart play: discards highest-point card from invalid groups
  - Dumb play: discards a random card (may break valid groups)
  - `smartChance = winRate + difficultyBonus` (easy: -20, medium: 0, hard: +20)

### Declaration Validation
Uses backtracking solver (`getDeclarationVerdict`):
1. Tries all possible groupings of 13 cards
2. Validates each potential grouping against rules
3. Returns valid if any arrangement satisfies: 1 pure seq + 2 total seqs + all valid groups

### Player Hand Interactions
- **Tap**: Select/deselect card (multi-select for Group, single for Discard/Declare)
- **Drag within group**: Reorder cards freely
- **Drag between groups**: Move card to another group
- **Drag away from hand**: Auto-discard (if in discard phase)
- **Sort button**: Auto-groups by best melds (greedy algorithm)
- **Group button**: Selected cards form a new group
- Group labels update in real-time: "Pure Seq", "Sequence", "Set", or "Xpts" (invalid)

### Responsive Layout
- `calculateAlignment()` in `alignmentConfig.js` computes all dimensions
- Card sizes: 55–75px width based on viewport
- AI seats positioned around oval table (5 position maps for different player counts)
- Landscape forced on native (Capacitor ScreenOrientation)
- Desktop: phone shell wrapper (390×844px)

---

## Multiplayer System

### Server Architecture (server.js)

**Data Stores** (in-memory):
```javascript
rooms = { [code]: { host, hostPlayerId, players: [{id, playerId, name}] } }
games = { [code]: { players, deck, hands, discardPile, turnIndex, state } }
```

### Socket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `register_room` | Client→Server | Host creates room |
| `join_room` | Client→Server | Player joins room |
| `validate_room` | Client→Server | Check if room exists |
| `rejoin_room` | Client→Server | Reconnect to room |
| `room_update` | Server→Room | Player list changed |
| `start_game` | Client→Server | Host starts game (10s countdown) |
| `game_starting` | Server→Room | Countdown broadcast |
| `game_state` | Server→Player | Personalized game snapshot |
| `draw_card` | Client→Server | Player draws |
| `discard_card` | Client→Server | Player discards |
| `game_error` | Server→Player | Validation error |
| `host_changed` | Server→Room | Host migrated |
| `room_closed` | Server→Room | Room deleted |

### Key Design Decisions
- **Personalized snapshots**: Each player only sees their own hand — opponents show `handSize` only
- **Persistent player ID**: `localStorage` based — survives socket reconnects
- **Host verification**: Uses `playerId` not `socket.id` (socket.id changes on reconnect)
- **Host migration**: If host disconnects, next player becomes host
- **Turn validation**: Server enforces turn order (rejects out-of-turn actions)
- **Deck reshuffling**: When draw pile empty, discard pile (except top) is reshuffled

### Multiplayer Lobby Flow
1. Host creates room → `register_room` → gets code → shares it
2. Joiners enter code → `join_room` → lobby updates via `room_update`
3. After 60s with empty slots, host gets bot-fill prompt (client-side only)
4. Host clicks Start → `start_game` → server starts 10s countdown
5. After countdown → server deals, broadcasts `game_state` to all
6. All clients navigate to GameScreen on receiving `game_state`

---

## Admin Panel (AdminPanel.jsx + adminStore.js)

### Accessible From
Main Menu → ⚙️ gear icon (top-left)

### Configurable Settings

| Setting | Range | Default | Effect |
|---------|-------|---------|--------|
| Bot Count | 1–5 | 5 | Number of AI opponents in practice mode |
| Bot Win Rate | 0–100% | 30% | How smart bots play (higher = strategic discards) |
| Bot Speed | 300–3000ms | 1000ms | Delay between bot draw and discard |
| Bot Difficulty | Easy/Medium/Hard | Medium | ±20% modifier to win rate |
| Turn Timer | 10–60s | 30s | Main countdown per turn |
| Penalty Timer | 5–30s | 10s | Red overtime before auto-discard |
| Bot Names | Editable | Priya, Rahul, Sneha, Amit, Kavya | Tap to rename |

### Persistence
- Stored in `localStorage` as `star_rummy_admin_config`
- Changes apply to the **next game** started (not current game)
- Reset to defaults button available

### Integration with GameScreen
- `useAdminStore.getState()` called at:
  - Game initialization (bot count, names)
  - Turn start (timer values)
  - AI turn scheduling (bot speed)
  - AI discard logic (win rate + difficulty)
  - Timer display (totalSeconds)

---

## Player Hand System (PlayerHand.jsx)

### Card Grouping
- Cards start in ONE flat group (all 13 together)
- Sort button: auto-groups by best melds using greedy algorithm
- Group button: multi-selected cards form a new group
- Drag: freely move cards within/between groups

### Group Evaluation (real-time labels)
Each group shows a label that updates instantly:
- **Pure Seq** (blue) — same suit, consecutive, no printed jokers
- **Sequence** (green) — same suit, consecutive with joker gaps
- **Set** (green) — same rank, different suits, 3–4 cards
- **Xpts** (red) — invalid, shows total point value

### Drag & Drop (@dnd-kit)
- PointerSensor: activates after 10px movement
- TouchSensor: activates after 10px movement (no time delay for mobile)
- Drag away from hand: auto-discard (if in discard phase)
- Drop on another card: reorders within/between groups
- Drop on group zone: moves card to that group
- Empty groups auto-cleaned after moves

### Touch Optimization
- Extra invisible padding (8px horizontal, 12px vertical) around each card
- Visual card size unchanged — only touch target is larger
- Pointer tracking for tap detection (8px threshold)
- `touchAction: none` prevents browser gestures

---

## State Management (store.js)

### Main Store (useGameStore)
```javascript
{
  // Navigation
  screen: 'splash' | 'home' | 'otp' | 'game' | 'match-lobby' | ...

  // User
  user: { uid, phone, jwt, isGuest, name, coins }
  isLoggedIn: boolean
  coins: number

  // Lobby
  gameMode: '101pool' | 'private'
  tableSize: 2 | 6
  entryFee: number
  activeRoomCode: string | null
  isRoomHost: boolean

  // Game
  gameState: object | null
  players: [], aiPlayers: [], playerHand: []
  drawPile: [], discardPile: []
  currentTurn: number, playerScore: number

  // Profile
  profileName, profileGender, profileEmail, profileAvatar
}
```

### Key Actions
- `setScreen(screen)` — navigation
- `initializeMockGameData()` — creates full solo game state
- `setGameData(data)` — accepts multiplayer game state from server
- `deductCoins(amount)` / `addCoins(amount)` — economy
- `resetGameData()` — clears game state

---

## Game Engine (src/game/engine.js)

Standalone validation module (also used for declaration checking):

- `createDeck()` — 2 full decks + 2 printed jokers (106 cards)
- `validateDeclaration(hand, groups, wildJoker)` — checks all rules
- `isValidGroup(cards, wildJoker)` — sequence or set check
- `isPureSequence(cards)` — no printed jokers, wild used as natural
- `isValidSequence(realCards, jokers)` — allows gap-filling with jokers
- `isValidSet(realCards, jokers)` — same rank, different suits, 3-4 cards
- `aiMakeMove(game, playerIdx)` — draw useful card → discard least useful

---

## Native (Capacitor)

```json
{
  "appId": "com.starrummy.game",
  "appName": "Star Rummy",
  "webDir": "dist",
  "android": { "allowMixedContent": true },
  "server": { "androidScheme": "https" }
}
```

- Screen orientation: landscape locked during game, portrait otherwise
- Plugins: `@capacitor/screen-orientation`
- Build: `npm run build` → `npx cap sync android` → Android Studio build
- Backend URL: `VITE_BACKEND_URL` env var (defaults to Railway production)

---

## Key Design Patterns

1. **Dual-mode game**: Solo (all logic client-side) vs Multiplayer (server-authoritative). Same GameScreen component handles both via `isMultiplayer` flag.

2. **Turn locking**: `isAdvancingTurnRef` + `aiTurnExecutingRef` prevent duplicate/overlapping turns. All turn changes go through `turnEngine.advanceTurnOnce()`.

3. **Animation-first UX**: Cards fly with physics animations (deal, draw, discard). Game state updates happen AFTER animation completes (setTimeout callbacks).

4. **Reconnection resilience**: Persistent `playerId` in localStorage, socket `rejoin_room` on reconnect, `request_game_state` to resync missed broadcasts.

5. **Responsive everything**: `calculateAlignment()` computes all sizes from viewport dimensions — card sizes, seat positions, button sizes, table dimensions.

---

## Environment Variables

```
VITE_BACKEND_URL=https://star-rummy-101-production.up.railway.app
PORT=3000 (server)
```

## Build Commands

```bash
npm run dev          # Vite dev server
npm run build        # Production build → dist/
npm start            # Start Express server (server.js)
npx cap sync android # Sync web build to Android
npx cap open android # Open in Android Studio
```
