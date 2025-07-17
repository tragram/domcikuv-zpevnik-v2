
import React from 'react'
import { Button } from '~/components/shadcn-ui/button'
import { MoveDiagonal, MoveHorizontal, Columns2, Fullscreen, AArrowDown, AArrowUp, PencilRuler, Repeat, Maximize, Brain } from 'lucide-react'
import { type LayoutPreset, type LayoutSettings, useViewSettingsStore } from '../hooks/viewSettingsStore'
import type { FullScreenHandle } from 'react-full-screen'
import { DropdownIconStart, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '~/components/shadcn-ui/dropdown-menu'
import { LoopNoteIcon } from '~/components/shadcn-ui/loop-note-icon'
import SmartColumnIcon from "./smart_columns_icon"
import FancySwitch from '~/components/FancySwitch'

const layouSettingsBoolsKeys = ["multiColumns", "smartColumns", "repeatParts", "repeatPartsChords", "compactInFullScreen"] as const satisfies ReadonlyArray<keyof LayoutSettings>;
export const layoutSettingsValues = {
  "multiColumns": { icon: <Columns2 />, label: "Multicolumn view" },
  "smartColumns": { icon: <Brain />, label: "Smart columns" },
  "repeatParts": { icon: <Repeat />, label: "Show repeated parts" },
  "repeatPartsChords": { icon: <LoopNoteIcon />, label: "Show chords in repeated parts" },
  "compactInFullScreen": { icon: <Maximize />, label: "Auto fullscreen in compact view" }
}

export const layoutSettingsClassNames = (layout: LayoutSettings) => {
  return [layout.repeatPartsChords ? '' : 'repeated-chords-hidden',
  layout.repeatParts ? 'repeated-parts-shown' : 'repeated-parts-hidden',
  `fit-screen-${layout.fitScreenMode}`]
}

export const LayoutSettingsToolbar: React.FC<{
  fullScreenHandle: FullScreenHandle
}> = ({ fullScreenHandle }) => {
  const { layout, actions } = useViewSettingsStore();
  const layoutPreset = actions.getCurrentPreset();
  const presetOptions = [
    {
      icon: <MoveDiagonal />,
      label: 'Compact',
      value: 'compact' as LayoutPreset,
    },
    {
      icon: <PencilRuler />,
      label: 'Custom',
      value: 'custom' as LayoutPreset,
    },
    {
      icon: <MoveHorizontal />,
      label: 'Scroll',
      value: 'maximizeFontSize' as LayoutPreset,
    },
  ]

  return (
    <>
      <Button
        size="icon"
        variant="circular"
        className="max-[525px]:hidden"
        isActive={layout.multiColumns}
        onClick={() => actions.setLayoutSettings({ multiColumns: !layout.multiColumns })}
      >
        {layout.smartColumns ? <SmartColumnIcon /> : <Columns2 />}
      </Button>

      <Button
        size="icon"
        variant="circular"
        className="max-[620px]:hidden"
        onClick={fullScreenHandle.enter}
      >
        <Fullscreen />
      </Button>

      <div className='flex flex-grow h-full align-center justify-center max-xsm:hidden max-md:[&_.fancy-switch-label]:hidden'
        id="preset-selector-large">
        <FancySwitch
          options={presetOptions}
          setSelectedOption={(preset: LayoutPreset) => {
            actions.applyPreset(preset);
            if (preset === 'compact' && layout.compactInFullScreen) {
              fullScreenHandle.enter();
            }
          }}
          selectedOption={layoutPreset}
          roundedClass={"rounded-full"}
        />
      </div>
      <div className='flex flex-grow h-full align-center justify-center [&_.fancy-switch-label]:hidden xsm:hidden'
        id="preset-selector-small">
        <FancySwitch
          options={presetOptions.filter(o => o.value !== "custom")}
          setSelectedOption={(preset: LayoutPreset) => {
            actions.applyPreset(preset);
            if (preset === 'compact' && layout.compactInFullScreen) {
              fullScreenHandle.enter();
            }
          }}
          selectedOption={layoutPreset}
          hiddenHighlightOnOther={true}
          roundedClass={"rounded-full"}
        />
      </div>
    </>
  )
}

export const LayoutSettingsDropdownSection: React.FC = () => {
  const { layout: layoutSettings, actions } = useViewSettingsStore();
  function setBothSettings(modifiedSettings: Partial<LayoutSettings>) {
    actions.setLayoutSettings({ ...modifiedSettings });
    actions.setCustomLayoutPreset({ ...modifiedSettings });
  }
  const FONT_SIZE_STEP = 1.2;
  return (<>
    <DropdownMenuLabel>Font size</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuCheckboxItem
      key="fitXY"
      checked={layoutSettings.fitScreenMode === "fitXY"}
      onSelect={e => e.preventDefault()}
      onCheckedChange={() => actions.setLayoutSettings({ fitScreenMode: "fitXY" })}
    >
      <DropdownIconStart icon={<MoveDiagonal />} />
      Fit screen
    </DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem
      key="fitX"
      checked={layoutSettings.fitScreenMode === "fitX"}
      onSelect={e => e.preventDefault()}
      onCheckedChange={() => actions.setLayoutSettings({ fitScreenMode: "fitX" })}
    >
      <DropdownIconStart icon={<MoveHorizontal />} />
      Fit screen width
    </DropdownMenuCheckboxItem>
    <DropdownMenuItem
      onClick={() => setBothSettings({
        fitScreenMode: "none",
        fontSize: layoutSettings.fontSize * FONT_SIZE_STEP
      })}
      onSelect={e => e.preventDefault()}
    >
      <DropdownIconStart icon={<AArrowUp />} />
      Increase font size
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => setBothSettings({
        fitScreenMode: "none",
        fontSize: layoutSettings.fontSize / FONT_SIZE_STEP
      })}
      onSelect={e => e.preventDefault()}
    >
      <DropdownIconStart icon={<AArrowDown />} />
      Decrease font size
    </DropdownMenuItem>

    <DropdownMenuLabel>Contents</DropdownMenuLabel>
    <DropdownMenuSeparator />
    {
      layouSettingsBoolsKeys.map(k => (
        <DropdownMenuCheckboxItem
          key={k}
          checked={layoutSettings[k]}
          onCheckedChange={() => ["repeatParts", "repeatPartsChords"].includes(k) ? setBothSettings({ [k]: !layoutSettings[k] }) : actions.setLayoutSettings({ [k]: !layoutSettings[k] })}
          onSelect={e => e.preventDefault()}
        >
          <DropdownIconStart icon={layoutSettingsValues[k].icon} />
          {layoutSettingsValues[k].label}
        </DropdownMenuCheckboxItem>
      ))
    }
  </>
  );
}