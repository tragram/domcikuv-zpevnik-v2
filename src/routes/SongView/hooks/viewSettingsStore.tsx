import { Key } from '@/musicTypes'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Shared types across settings
export type FitScreenMode = 'none' | 'fitX' | 'fitXY'
export type LayoutPreset = 'compact' | 'maximizeFontSize' | 'custom'

// Core settings interfaces
export interface LayoutSettings {
  fitScreenMode: FitScreenMode
  fontSize: number
  repeatParts: boolean
  repeatPartsChords: boolean
  twoColumns: boolean
  compactInFullScreen: boolean
}

export interface ChordSettings {
  showChords: boolean
  czechChordNames: boolean
  inlineChords: boolean
}

export interface TransposeSettings {
  steps: number
  originalKey: Key | undefined
}

// Constants and preset configurations
export const LAYOUT_PRESETS = {
  compact: {
    fitScreenMode: 'fitXY' as FitScreenMode,
    repeatParts: false,
    repeatPartsChords: false,
    twoColumns: false,
    compactInFullScreen: true,
    fontSize: 12,
  },
  maximizeFontSize: {
    fitScreenMode: 'fitX' as FitScreenMode,
    repeatParts: true,
    repeatPartsChords: true,
    twoColumns: false,
    compactInFullScreen: false,
    fontSize: 12,
  },
} as const

// Store interface
interface SettingsState {
  layout: LayoutSettings
  customLayoutPreset: LayoutSettings
  layoutPreset: LayoutPreset
  chords: ChordSettings
  transpose: TransposeSettings
  actions: {
    setLayoutSettings: (settings: Partial<LayoutSettings>) => void
    setCustomLayoutPreset: (settings: Partial<LayoutSettings>) => void
    setLayoutPreset: (preset: LayoutPreset) => void
    setChordSettings: (settings: Partial<ChordSettings>) => void
    setTransposeSteps: (steps: number) => void
    setOriginalKey: (key: Key | null) => void
    applyPreset: (preset: LayoutPreset) => void
    resetTranspose: () => void
  }
}

// Utility functions
const getFontSizeInRange = (size: number) => {
  const MIN_FONT_SIZE = 4
  const MAX_FONT_SIZE = 160
  return Math.min(Math.max(MIN_FONT_SIZE, size), MAX_FONT_SIZE)
}

// Create store
export const useViewSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      layout: {
        ...LAYOUT_PRESETS.compact,
        fontSize: 12,
      },
      customLayoutPreset: {
        ...LAYOUT_PRESETS.compact,
        fontSize: 12,
      },
      layoutPreset: 'compact',
      chords: {
        showChords: true,
        czechChordNames: true,
        inlineChords: true,
      },
      transpose: {
        steps: 0,
        originalKey: undefined,
      },
      actions: {
        setLayoutSettings: (settings) =>
          set((state) => ({
            layout: {
              ...state.layout,
              ...settings,
              fontSize: settings.fontSize
                ? getFontSizeInRange(settings.fontSize)
                : state.layout.fontSize,
            },
          })),
        setCustomLayoutPreset: (settings) =>
          set((state) => ({
            customLayoutPreset: {
              ...state.customLayoutPreset,
              ...settings,
            },
          })),
        setLayoutPreset: (preset) =>
          set(() => ({
            layoutPreset: preset,
          })),
        setChordSettings: (settings) =>
          set((state) => ({
            chords: {
              ...state.chords,
              ...settings,
            },
          })),
        setTransposeSteps: (steps) =>
          set((state) => ({
            transpose: {
              ...state.transpose,
              steps,
            },
          })),
        setOriginalKey: (key) =>
          set((state) => ({
            transpose: {
              ...state.transpose,
              originalKey: key || undefined,
            },
          })),
        applyPreset: (preset) => {
          const { actions, customLayoutPreset } = get()
          if (preset === 'custom') {
            actions.setLayoutSettings(customLayoutPreset)
          } else {
            actions.setLayoutSettings({
              ...LAYOUT_PRESETS[preset],
              compactInFullScreen: customLayoutPreset.compactInFullScreen
            })
          }
          actions.setLayoutPreset(preset)
        },
        resetTranspose: () =>
          set((state) => ({
            transpose: {
              ...state.transpose,
              steps: 0,
            },
          })),
      },
    }),
    {
      name: 'songview-settings-store',

      partialize: (state) => ({
        // Only persist the data state, not the actions
        layout: state.layout,
        customLayoutPreset: state.customLayoutPreset,
        layoutPreset: state.layoutPreset,
        chords: state.chords,
        transpose: {
          originalKey: state.transpose.originalKey?.toString(),
          steps: 0
        },
      }),

      // onRehydrateStorage: (state) => {
      //   console.log(state)
      //   state.transpose.originalKey = Key.parse(state.transpose.originalKey || null);
      //   // set((state) => ({
      //   //   transpose: {
      //   //     ...state.transpose,
      //   //     originalKey: Key.parse(state.transpose.originalKey),
      //   //   }
      //   // }))
      // }
    }
  )
)