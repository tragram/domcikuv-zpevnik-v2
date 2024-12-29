import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Shared types across settings
export type FitScreenMode = 'none' | 'fitX' | 'fitXY'
export type LayoutPreset = 'compact' | 'maximizeFontSize' | 'custom'
export const isSmallScreen = () => window.matchMedia('(max-width: 768px)').matches;

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

// Constants and preset configurations
export const LAYOUT_PRESETS = {
  compact: {
    fitScreenMode: 'fitXY' as FitScreenMode,
    repeatParts: false,
    repeatPartsChords: false,
    twoColumns: false,
    fontSize: 12,
  },
  maximizeFontSize: {
    fitScreenMode: 'fitX' as FitScreenMode,
    repeatParts: true,
    repeatPartsChords: true,
    twoColumns: false,
    fontSize: 12,
  },
} as const

const defaultLayoutSettings: LayoutSettings = isSmallScreen()
  ? {
    fitScreenMode: 'fitX',
    fontSize: 12,
    repeatParts: true,
    repeatPartsChords: true,
    twoColumns: false,
    compactInFullScreen: true,
  }
  :
  {
    fitScreenMode: 'fitXY',
    fontSize: 12,
    repeatParts: false,
    repeatPartsChords: false,
    twoColumns: true,
    compactInFullScreen: false,
  };

// Store interface
interface SettingsState {
  layout: LayoutSettings
  customLayoutPreset: LayoutSettings
  layoutPreset: LayoutPreset
  chords: ChordSettings
  actions: {
    setLayoutSettings: (settings: Partial<LayoutSettings>) => void
    setCustomLayoutPreset: (settings: Partial<LayoutSettings>) => void
    setLayoutPreset: (preset: LayoutPreset) => void
    setChordSettings: (settings: Partial<ChordSettings>) => void
    applyPreset: (preset: LayoutPreset) => void
  }
}

// Utility functions
const getFontSizeInRange = (size: number) => {
  const MIN_FONT_SIZE = 4
  const MAX_FONT_SIZE = 160
  return Math.min(Math.max(MIN_FONT_SIZE, size), MAX_FONT_SIZE)
}

export const useViewSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      layout: defaultLayoutSettings,
      customLayoutPreset: {
        ...LAYOUT_PRESETS.compact,
        compactInFullScreen: isSmallScreen() ? true : false,
      },
      layoutPreset: isSmallScreen() ? 'maximizeFontSize' : 'compact',
      chords: {
        showChords: true,
        czechChordNames: true,
        inlineChords: true,
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
      }),
    }
  )
)