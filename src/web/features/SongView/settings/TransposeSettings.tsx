// import { ButtonGroup, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import { Button } from "~/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { useEffect, useMemo, useRef, useState } from "react";
import { Note } from "~/types/musicTypes";
import { Key } from "~/types/musicTypes";
import TransposeIcon from "./transpose_icon"
import ToolbarBase from "~/components/ToolbarBase";
import FancySwitch from "~/components/FancySwitch";

const RENDER_KEYS = ['C', 'C#', 'D', 'Es', 'E', 'F', 'F#', 'G', 'As', 'A', 'B', 'H'];


interface TransposeSettingsProps {
  originalKey: Key | undefined;
  transposeSteps: number
  setTransposeSteps: (value: number) => void
}

const TransposeSettings: React.FC<TransposeSettingsProps> = ({ originalKey, transposeSteps, setTransposeSteps }) => {
  const originalKeyIndex = originalKey?.note
    ? new Note('C').semitonesBetween(originalKey?.note)
    : 0;

  const transposeValues = useMemo(
    () => [...Array(12).keys()].map((v) => v - originalKeyIndex),
    [originalKeyIndex]
  );

  return (
    <div className="flex items-center h-full">
      <div className="hidden xl:block h-full">
        <TransposeButtons
          values={transposeValues}
          selected={transposeSteps}
          onChange={setTransposeSteps}
        />
      </div>

      <div className="xl:hidden h-full">
        <TransposeDropdown
          values={transposeValues}
          selected={transposeSteps}
          onChange={setTransposeSteps}
        />
      </div>
    </div>
  );
};

function useComponentVisible(initialIsVisible: boolean) {
  const [isComponentVisible, setIsComponentVisible] = useState(initialIsVisible);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = (event: MouseEvent) => {
    if (ref.current && !ref.current.contains(event.target as Node)) {
      setIsComponentVisible(false);
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, []);

  return { ref, isComponentVisible, setIsComponentVisible };
}

interface TransposeButtonsProps {
  values: number[];
  selected: number;
  onChange: (steps: number) => void;
  vertical?: boolean;
}

const TransposeButtons: React.FC<TransposeButtonsProps> = ({ values, selected, onChange, vertical = false }) => {
  return (
    <FancySwitch
      options={RENDER_KEYS.map((k, index) => ({ label: k, value: values[index] }))}
      selectedOption={selected}
      setSelectedOption={onChange}
      vertical={vertical}
      roundedClass={"rounded-full"}
      full={true}
    />
  );
};

interface TransposeDropdownProps {
  values: number[];
  selected: number;
  onChange: (steps: number) => void;
}

const TransposeDropdown: React.FC<TransposeDropdownProps> = ({ values, selected, onChange }) => {
  const { ref, isComponentVisible, setIsComponentVisible } = useComponentVisible(false);
  
  const handleToolbarOptionChange = (steps: number) => {
    onChange(steps);
    // setIsComponentVisible(false); // Close toolbar after selection
  };

  return (
    <>
      <div className='hidden xl:flex h-full'>
        <TransposeButtons values={values} selected={selected} onChange={onChange} />
      </div>
      <div className='xl:hidden flex max-[600px]:hidden'>
        <Button size="icon" variant="circular" onClick={() => setIsComponentVisible(!isComponentVisible)}>
          <TransposeIcon />
        </Button>
        <div className={"absolute top-13 w-fit right-[554px]"} ref={ref}>
          {isComponentVisible &&
            <ToolbarBase showToolbar={isComponentVisible} className="!px-0 w-fit">
              <div className="w-fit flex justify-center p-0 h-full min-h-10">
                <TransposeButtons values={values} selected={selected} onChange={handleToolbarOptionChange} />
              </div>
            </ToolbarBase>}
        </div>
      </div>
      <div className='max-sm:hidden flex min-[600px]:hidden'>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="circular">
              <TransposeIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-12">
            {RENDER_KEYS.map((k, index) => (
              <DropdownMenuCheckboxItem
                checked={selected === values[index]}
                key={k}
                onSelect={e => e.preventDefault()}
                onCheckedChange={() => onChange(values[index])}
              >
                {k}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default TransposeSettings;