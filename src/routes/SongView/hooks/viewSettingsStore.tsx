import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Shared types across settings
export type FitScreenMode = 'none' | 'fitX' | 'fitXY'
export type LayoutPreset = 'compact' | 'maximizeFontSize' | 'custom'
export const isSmallScreen = () => window.matchMedia('(max-width: 768px)').matches;

// Separate interfaces for preset fields vs independent settings
export interface PresetSettings {
  fitScreenMode: FitScreenMode
  repeatParts: boolean
  repeatPartsChords: boolean
}

export interface IndependentLayoutSettings {
  fontSize: number
  multiColumns: boolean
  compactInFullScreen: boolean
}

export interface LayoutSettings extends PresetSettings, IndependentLayoutSettings { }

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
  },
  maximizeFontSize: {
    fitScreenMode: 'fitX' as FitScreenMode,
    repeatParts: true,
    repeatPartsChords: true,
  },
} as const

const defaultIndependentSettings: IndependentLayoutSettings = isSmallScreen()
  ? {
    fontSize: 12,
    multiColumns: false,
    compactInFullScreen: true,
  }
  : {
    fontSize: 12,
    multiColumns: true,
    compactInFullScreen: false,
  };

const defaultPresetSettings: PresetSettings = isSmallScreen()
  ? LAYOUT_PRESETS.maximizeFontSize
  : LAYOUT_PRESETS.compact;

// Function to determine which preset matches current settings
const getCurrentPreset = (settings: PresetSettings): LayoutPreset => {
  if (settings.fitScreenMode === "fitXY") {
    return "compact";
  } else if (settings.fitScreenMode === "fitX") {
    return "maximizeFontSize";
  } else {
    return "custom";
  }
};

// Store interface
interface SettingsState {
  layout: LayoutSettings
  customLayoutPreset: PresetSettings
  chords: ChordSettings
  actions: {
    setLayoutSettings: (settings: Partial<LayoutSettings>) => void
    setCustomLayoutPreset: (settings: Partial<PresetSettings>) => void
    setChordSettings: (settings: Partial<ChordSettings>) => void
    applyPreset: (preset: LayoutPreset) => void
    getCurrentPreset: () => LayoutPreset
  }
}

// Utility functions
const MIN_FONT_SIZE = 4
const MAX_FONT_SIZE = 80
export const getFontSizeInRange = (size: number, min: number = MIN_FONT_SIZE, max: number = MAX_FONT_SIZE) => {
  return Math.min(Math.max(min, size), max)
}

export const useViewSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      layout: {
        ...defaultPresetSettings,
        ...defaultIndependentSettings,
      },
      customLayoutPreset: {
        ...defaultPresetSettings,
      },
      chords: {
        showChords: true,
        czechChordNames: true,
        inlineChords: true,
      },
      actions: {
        setLayoutSettings: (settings) =>
          set((state) => {
            // If we're just updating fontSize, do it directly without any other logic
            if (Object.keys(settings).length === 1 && 'fontSize' in settings) {
              return {
                layout: {
                  ...state.layout,
                  fontSize: getFontSizeInRange(settings.fontSize!)
                }
              };
            }
            const newLayout = {
              ...state.layout,
              ...settings,
              fontSize: settings.fontSize
                ? getFontSizeInRange(settings.fontSize)
                : state.layout.fontSize,
            };
            return { layout: newLayout };
          }),
        setCustomLayoutPreset: (settings) =>
          set((state) => ({
            customLayoutPreset: {
              ...state.customLayoutPreset,
              ...settings,
            },
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
          let presetSettings = preset === 'custom'
            ? customLayoutPreset
            : LAYOUT_PRESETS[preset];
          if (preset === "custom") {
            presetSettings = {...presetSettings, fitScreenMode: "none" };
          }
          actions.setLayoutSettings(presetSettings);
        },
        getCurrentPreset: () => {
          const state = get();
          return getCurrentPreset(state.layout);
        },
      },
    }),
    {
      name: 'songview-settings-store',
      partialize: (state) => ({
        layout: state.layout,
        customLayoutPreset: state.customLayoutPreset,
        chords: state.chords,
      }),
    }
  )
)