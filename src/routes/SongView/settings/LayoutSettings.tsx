
import React from 'react'
import { Button } from '@/components/ui/button'
import { MoveDiagonal, MoveHorizontal, Columns2, Fullscreen, AArrowDown, AArrowUp, PencilRuler, Repeat, Maximize } from 'lucide-react'
import FancySwitch from '@/components/ui/fancy-switch'
import { LayoutPreset, LayoutSettings, useViewSettingsStore } from '../hooks/viewSettingsStore'
import { FullScreenHandle } from 'react-full-screen'
import { DropdownIconStart, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { LoopNoteIcon } from '@/components/ui/loop-note-icon'

const layouSettingsBoolsKeys = ["twoColumns", "repeatParts", "repeatPartsChords", "compactInFullScreen"]  as const satisfies ReadonlyArray<keyof LayoutSettings>;
const layoutSettingsValues = {
    "twoColumns": { icon: <Columns2 />, label: "View as two columns" },
    "repeatParts": { icon: <Repeat />, label: "Show repeated parts" },
    "repeatPartsChords": { icon: <LoopNoteIcon />, label: "Show chords in repeated parts" },
    "compactInFullScreen": { icon: <Maximize />, label: "Auto fullscreen in compact view" }
}


export const LayoutSettingsToolbar: React.FC<{
  fullScreenHandle: FullScreenHandle
}> = ({ fullScreenHandle }) => {
  const { layout, layoutPreset, actions } = useViewSettingsStore();
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
        className="max-sm:hidden"
        isActive={layout.twoColumns}
        onClick={() => actions.setLayoutSettings({ twoColumns: !layout.twoColumns })}
      >
        <Columns2 />
      </Button>

      <Button
        size="icon"
        variant="circular"
        className="max-[620px]:hidden"
        onClick={fullScreenHandle.enter}
      >
        <Fullscreen />
      </Button>

      <div className='flex flex-grow h-full align-center justify-center max-xsm:hidden  max-md:hide-fancy-switch-label '
        id="preset-selector-large">
        <FancySwitch
          options={presetOptions}
          setSelectedOption={(preset: LayoutPreset) => {
            actions.applyPreset(preset);
            // console.log(layout.compactInFullScreen)
            if (preset === 'compact' && layout.compactInFullScreen && false) {
              fullScreenHandle.enter();
            }
          }}
          selectedOption={layoutPreset}
          roundedClass={"rounded-full"}
        />
      </div>
      <div className='flex flex-grow h-full align-center justify-center hide-fancy-switch-label xsm:hidden'
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

export const LayoutSettingsDropdownSection: React.FC<{
  fullScreenHandle: FullScreenHandle
}> = ({ fullScreenHandle }) => {
  const { layout: layoutSettings, actions } = useViewSettingsStore();
  function setBothSettings(modifiedSettings: Partial<LayoutSettings>) {
    actions.setLayoutSettings({ ...modifiedSettings });
    actions.setCustomLayoutPreset({ ...modifiedSettings });
    actions.setLayoutPreset('custom'); // Switch to custom preset when modifying settings
  }
  const FONT_SIZE_STEP = 1.2;
  return (<>
    <DropdownMenuLabel>Font size</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuCheckboxItem
      key="fitXY"
      checked={layoutSettings.fitScreenMode === "fitXY"}
      onSelect={e => e.preventDefault()}
      onCheckedChange={() => setBothSettings({ fitScreenMode: "fitXY" })}
    >
      <DropdownIconStart icon={<MoveDiagonal />} />
      Fit screen
    </DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem
      key="fitX"
      checked={layoutSettings.fitScreenMode === "fitX"}
      onSelect={e => e.preventDefault()}
      onCheckedChange={() => setBothSettings({ fitScreenMode: "fitX" })}
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
    <DropdownMenuItem onClick={() => { fullScreenHandle.enter() }}>
      <DropdownIconStart icon={<Fullscreen />} />
      Enter fullscreen
    </DropdownMenuItem >
    {
      layouSettingsBoolsKeys.map(k => (
        <DropdownMenuCheckboxItem
          key={k}
          checked={layoutSettings[k]}
          onCheckedChange={() => setBothSettings({[k]: !layoutSettings[k]})}
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