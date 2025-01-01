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
  twoColumns: boolean
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
    twoColumns: false,
    compactInFullScreen: true,
  }
  : {
    fontSize: 12,
    twoColumns: true,
    compactInFullScreen: false,
  };

const defaultPresetSettings: PresetSettings = isSmallScreen()
  ? LAYOUT_PRESETS.maximizeFontSize
  : LAYOUT_PRESETS.compact;

// Function to determine which preset matches current settings
const getCurrentPreset = (settings: PresetSettings): LayoutPreset => {
  const presetEntries = Object.entries(LAYOUT_PRESETS) as [LayoutPreset, PresetSettings][];

  for (const [presetName, presetSettings] of presetEntries) {
    if (
      presetSettings.fitScreenMode === settings.fitScreenMode &&
      presetSettings.repeatParts === settings.repeatParts &&
      presetSettings.repeatPartsChords === settings.repeatPartsChords
    ) {
      return presetName;
    }
  }

  return 'custom'; // If no match found, it must be custom
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
const getFontSizeInRange = (size: number) => {
  const MIN_FONT_SIZE = 4
  const MAX_FONT_SIZE = 160
  return Math.min(Math.max(MIN_FONT_SIZE, size), MAX_FONT_SIZE)
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
            const newLayout = {
              ...state.layout,
              ...settings,
              fontSize: settings.fontSize
                ? getFontSizeInRange(settings.fontSize)
                : state.layout.fontSize,
            };

            // If current settings match custom preset and preset fields were changed,
            // update the custom preset
            if (getCurrentPreset(state.layout) === 'custom') {
              const presetFields: Partial<PresetSettings> = {};
              if ('fitScreenMode' in settings) presetFields.fitScreenMode = settings.fitScreenMode;
              if ('repeatParts' in settings) presetFields.repeatParts = settings.repeatParts;
              if ('repeatPartsChords' in settings) presetFields.repeatPartsChords = settings.repeatPartsChords;

              if (Object.keys(presetFields).length > 0) {
                return {
                  layout: newLayout,
                  customLayoutPreset: {
                    ...state.customLayoutPreset,
                    ...presetFields,
                  },
                };
              }
            }

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
          const presetSettings = preset === 'custom'
            ? customLayoutPreset
            : LAYOUT_PRESETS[preset];

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