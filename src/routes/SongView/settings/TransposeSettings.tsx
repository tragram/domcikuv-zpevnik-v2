// import { ButtonGroup, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import FancySwitch from "@/components/ui/fancy-switch";
import { ArrowUpDown } from "lucide-react";
import ToolbarBase from "@/components/ui/toolbar-base";
import { useEffect, useMemo, useRef, useState } from "react";
import { Note } from "@/types";
import { Key } from "@/musicTypes";

const RENDER_KEYS = ['C', 'C#', 'D', 'Es', 'E', 'F', 'F#', 'G', 'As', 'A', 'B', 'H'];


interface TransposeSettingsProps {
  originalKey: Key | undefined;
  transposeSteps: number
  setTransposeSteps: (value: number) => void
}

const TransposeSettings: React.FC<TransposeSettingsProps> = ({ originalKey, transposeSteps, setTransposeSteps }) => {


  console.log(originalKey?.toString(), transposeSteps)
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

  return (
    <>
      <div className='hidden xl:flex h-full'>
        <TransposeButtons values={values} selected={selected} onChange={onChange} />
      </div>
      <div className='xl:hidden max-sm:hidden'>
        <Button size="icon" variant="circular" onClick={() => setIsComponentVisible(!isComponentVisible)}>
          <ArrowUpDown />
        </Button>
        <div className={"absolute top-14 w-fit left-0"} ref={ref}>
          {isComponentVisible &&
            <ToolbarBase showToolbar={isComponentVisible} className="!px-0">
              <div className="w-full flex justify-center p-0 h-full">
                <TransposeButtons values={values} selected={selected} onChange={onChange} />
              </div>
            </ToolbarBase>}
        </div>
      </div>
      <div className='sm:hidden xl:hidden flex'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="circular" onClick={() => setIsComponentVisible(!isComponentVisible)}>
              <ArrowUpDown />
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