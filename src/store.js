import { create } from 'zustand'

const asArray = (value) => (Array.isArray(value) ? value : [])

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = ['S', 'H', 'D', 'C']

const createEmptyGameData = () => ({
  players: [],
  aiPlayers: [],
  playerHand: [],
  cards: [],
  tableCards: [],
  drawPile: [],
  discardPile: [],
})

const createMockDeck = () => {
  let id = 0
  const deck = []

  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push({
        id: `mock-${id++}`,
        rank,
        suit,
        pts: ['A', 'J', 'Q', 'K', '10'].includes(rank) ? 10 : Number(rank),
      })
    })
  })

  deck.push({ id: `mock-${id++}`, rank: 'JOKER', suit: '', pts: 0, isJoker: true })
  deck.push({ id: `mock-${id++}`, rank: 'JOKER', suit: '', pts: 0, isJoker: true })

  return deck
}

const shuffle = (cards) => {
  const next = [...cards]

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }

  return next
}

const createMockGameData = ({ user = null, roomCode = null } = {}) => {
  const playerCount = 6
  console.log('STEP 3: deck created', { playerCount })
  const deck = shuffle([...createMockDeck(), ...createMockDeck()])
  const hands = Array.from({ length: playerCount }, (_, i) => deck.slice(i * 13, (i + 1) * 13))
  console.log('STEP 4: cards dealt', { handCount: hands.length, cardCount: deck.length })
  const offset = playerCount * 13
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: i === 0 ? 'you' : `bot-${i}`,
    userId: i === 0 ? user?.uid || user?.userId || 'you' : `bot-${i}`,
    name: i === 0 ? user?.name || 'YOU' : `Bot ${i}`,
    hand: hands[i] || [],
    score: 0,
    isBot: i !== 0,
  }))
  console.log('STEP 5: players initialized', { players: players.length })
  console.log('STEP 5: players initialized', { players: players.length })
  const aiPlayers = players.slice(1).map((player, i) => ({
    id: i,
    name: player.name,
    hand: asArray(player.hand),
    score: 0,
    isEliminated: false,
  }))
  const drawPile = deck.slice(offset + 1)
  const discardPile = deck[offset] ? [deck[offset]] : []

  return {
    players,
    aiPlayers,
    playerHand: hands[0] || [],
    cards: deck,
    tableCards: [],
    drawPile,
    discardPile,
    roomCode: roomCode || `MOCK-${Date.now()}`,
    gameState: {
      gamePhase: 'draw',
      currentTurn: 0,
      players,
      playerHand: hands[0] || [],
      drawPile,
      discardPile,
      tableCards: [],
    },
  }
}

const normalizeGameState = (state) => {
  if (!state) return null

  return {
    ...state,
    players: asArray(state.players),
    aiPlayers: asArray(state.aiPlayers),
    playerHand: asArray(state.playerHand),
    cards: asArray(state.cards),
    tableCards: asArray(state.tableCards),
    drawPile: asArray(state.drawPile),
    discardPile: asArray(state.discardPile),
  }
}

const useGameStore = create((set, get) => ({
  // Navigation
  screen: 'splash', // home | splash | otp | match-lobby | private-room | join-room | subscription | game | profile | practice-mode | results

  // Lobby flow context (UI only)
  lobbyFlow: null, // null | 'create' | 'join'
  isRoomHost: false,
  
  // User
  user: null,
  authToken: null,
  phone: '',
  coins: 5000,
  isLoggedIn: false,

  // Profile
  profileName: '',
  profileGender: '',   // 'male' | 'female' | 'other' | ''
  profileEmail: '',
  profileAvatar: null, // emoji string e.g. '🧑'
  
  // Lobby
  gameMode: null, // '101pool' | 'private'
  tableSize: 6, // 2 or 6
  entryFee: 100,
  
  // Private room
  privateRoomCode: null,
  activeRoomCode: null,   // code host generated — joiners validate against this
  
  // Game state
  gameState: null,
  roomCode: null,
  isGameLoading: false,
  isGameReady: false,
  gameInitError: null,
  players: [],
  aiPlayers: [],
  playerHand: [],
  cards: [],
  tableCards: [],
  drawPile: [],
  discardPile: [],
  currentTurn: 0,
  playerScore: 0,
  opponentActions: {}, // { userId: { action, data, timestamp } }
  
  // Actions
  setScreen: (screen) => set({ screen }),
  setLobbyFlow: (lobbyFlow) => set({ lobbyFlow }),
  setIsRoomHost: (isRoomHost) => set({ isRoomHost }),
  setUser: (user) => set({
    user,
    authToken: user?.jwt || null,
    coins: user?.coins ?? 5000,
    isLoggedIn: !user?.isGuest // Guest users don't count as "logged in" for auth purposes
  }),
  setAuthToken: (authToken) => set({ authToken }),
  setPhone: (phone) => set({ phone }),
  setCoins: (coins) => set({ coins }),
  setGameMode: (mode) => set({ gameMode: mode }),
  setTableSize: (size) => set({ tableSize: size }),
  setEntryFee: (fee) => set({ entryFee: fee }),
  setProfile: ({ name, gender, email, avatar } = {}) => set(s => ({
    profileName: name !== undefined ? name : s.profileName,
    profileGender: gender !== undefined ? gender : s.profileGender,
    profileEmail: email !== undefined ? email : s.profileEmail,
    profileAvatar: avatar !== undefined ? avatar : s.profileAvatar,
  })),
  setPrivateRoomCode: (code) => set({ privateRoomCode: code }),
  setActiveRoomCode: (code) => set({ activeRoomCode: code }),
  setGameState: (state) => set({ gameState: normalizeGameState(state) }),
  setRoomCode: (code) => set({ roomCode: code }),
  setGameLoading: (isGameLoading) => set({ isGameLoading }),
  setGameReady: (isGameReady) => set({ isGameReady }),
  setPlayers: (players) => set({ players: asArray(players) }),
  setAiPlayers: (players) => set({ aiPlayers: asArray(players) }),
  setPlayerHand: (playerHand) => set({ playerHand: asArray(playerHand) }),
  setCards: (cards) => set({ cards: asArray(cards) }),
  setTableCards: (tableCards) => set({ tableCards: asArray(tableCards) }),
  setDrawPile: (drawPile) => set({ drawPile: asArray(drawPile) }),
  setDiscardPile: (discardPile) => set({ discardPile: asArray(discardPile) }),
  setGameData: (data = {}) => {
    const playerHand = asArray(data.playerHand)
    const gameState = normalizeGameState(data.gameState)

    set({
      players: asArray(data.players),
      aiPlayers: asArray(data.aiPlayers),
      playerHand,
      cards: asArray(data.cards),
      tableCards: asArray(data.tableCards),
      drawPile: asArray(data.drawPile),
      discardPile: asArray(data.discardPile),
      gameState,
      roomCode: data.roomCode ?? get().roomCode,
      gameInitError: null,
      isGameLoading: false,
      isGameReady: playerHand.length > 0 && !!gameState,
    })
  },
  resetGameData: () => set({
    ...createEmptyGameData(),
    gameState: null,
    gameInitError: null,
    isGameLoading: false,
    isGameReady: false,
  }),
  initializeMockGameData: () => {
    console.log('INIT START')
    const state = get()
    const data = createMockGameData({
      tableSize: state.tableSize,
      user: state.user,
      roomCode: state.roomCode,
    })

    console.log('STATE READY', {
      tableSize: state.tableSize,
      players: data.players.length,
      roomCode: data.roomCode,
    })
    set({
      ...createEmptyGameData(),
      players: asArray(data.players),
      aiPlayers: asArray(data.aiPlayers),
      playerHand: asArray(data.playerHand),
      cards: asArray(data.cards),
      tableCards: asArray(data.tableCards),
      drawPile: asArray(data.drawPile),
      discardPile: asArray(data.discardPile),
      gameState: normalizeGameState(data.gameState),
      roomCode: data.roomCode,
      gameInitError: null,
      isGameLoading: false,
      isGameReady: true,
    })
    console.log('STEP 6: loading false')
    console.log('INIT COMPLETE')
  },
  beginGameLoading: () => {
    console.log('beginGameLoading')
    set({
      isGameLoading: true,
      isGameReady: false,
      gameInitError: null,
      ...createEmptyGameData(),
    })
  },
  failGameLoading: (error = 'Game init failed') => {
    console.log('failGameLoading', error)
    set({
      ...createEmptyGameData(),
      gameState: null,
      isGameLoading: false,
      isGameReady: false,
      gameInitError: error,
    })
  },
  clearGameInitError: () => set({ gameInitError: null }),
  setCurrentTurn: (turn) => set({ currentTurn: turn }),
  setPlayerScore: (score) => set({ playerScore: score }),
  setOpponentActions: (actions) => set({ opponentActions: actions }),
  recordOpponentAction: (userId, action, data) =>
    set(s => ({
      opponentActions: {
        ...s.opponentActions,
        [userId]: { action, data, timestamp: Date.now() },
      },
    })),
  
  deductCoins: (amount) => set(s => ({ coins: Math.max(0, s.coins - amount) })),
  addCoins: (amount) => set(s => ({ coins: s.coins + amount })),
  clearUser: () => set({
    user: null,
    isLoggedIn: false,
    coins: 0,
    gameState: null,
    roomCode: null,
    isGameLoading: false,
    isGameReady: false,
    gameInitError: null,
    ...createEmptyGameData(),
  }),
}))

export default useGameStore
