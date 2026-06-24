import { create } from 'zustand'

// Default admin config
const DEFAULT_CONFIG = {
  botCount: 5,          // Number of bots (1–5 for 6-player table)
  botWinRate: 30,       // Bot win percentage (0–100)
  botSpeed: 1000,       // Bot turn delay in ms (500–3000)
  turnTimer: 30,        // Player turn timer in seconds (10–60)
  penaltyTimer: 10,     // Penalty phase timer in seconds (5–30)
  botDifficulty: 'medium', // 'easy' | 'medium' | 'hard'
  botNames: ['Priya', 'Rahul', 'Sneha', 'Amit', 'Kavya'],
}

// Load persisted config from localStorage
function loadConfig() {
  try {
    const saved = localStorage.getItem('star_rummy_admin_config')
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...DEFAULT_CONFIG, ...parsed }
    }
  } catch (e) {
    console.warn('[AdminStore] Failed to load config:', e)
  }
  return { ...DEFAULT_CONFIG }
}

// Save config to localStorage
function saveConfig(config) {
  try {
    localStorage.setItem('star_rummy_admin_config', JSON.stringify(config))
  } catch (e) {
    console.warn('[AdminStore] Failed to save config:', e)
  }
}

const useAdminStore = create((set, get) => ({
  ...loadConfig(),

  // Update a single field
  updateConfig: (key, value) => {
    set({ [key]: value })
    saveConfig({ ...get(), [key]: value })
  },

  // Update multiple fields at once
  updateMultiple: (updates) => {
    set(updates)
    saveConfig({ ...get(), ...updates })
  },

  // Reset to defaults
  resetConfig: () => {
    set({ ...DEFAULT_CONFIG })
    saveConfig(DEFAULT_CONFIG)
  },

  // Get full config snapshot
  getConfig: () => {
    const state = get()
    return {
      botCount: state.botCount,
      botWinRate: state.botWinRate,
      botSpeed: state.botSpeed,
      turnTimer: state.turnTimer,
      penaltyTimer: state.penaltyTimer,
      botDifficulty: state.botDifficulty,
      botNames: state.botNames,
    }
  },
}))

export default useAdminStore
