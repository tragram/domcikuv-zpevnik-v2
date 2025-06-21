import { cn } from '~/lib/utils';
import { FancySwitch as FancySwitchBase } from '@omit/react-fancy-switch';
import { useEffect, useState, type ReactNode } from 'react';

interface Option<T extends string | number = string> {
    value: T;
    label: string;
    icon?: ReactNode;
}

interface FancySwitchProps<T extends string | number> {
    options: Array<Option<T>>;
    selectedOption: T;
    setSelectedOption: (value: T) => void;
    roundedClass: string;
    children?: ReactNode;
    vertical?: boolean;
    full?: boolean;
    hiddenHighlightOnOther?: boolean;
}

export default function FancySwitch<T extends string | number>({
    options,
    selectedOption,
    setSelectedOption,
    roundedClass,
    children,
    vertical = false,
    full = false,
    hiddenHighlightOnOther = false
}: FancySwitchProps<T>) {
    const [animated, setAnimated] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setAnimated(true), 100);
        return () => clearTimeout(timer);
    }, []);
    const showHighlight = hiddenHighlightOnOther ? options.map(o => o.value).includes(selectedOption) : true;
    return (
        <div className={"h-full bg-white dark:bg-background/90 font-bold rounded-full transition-all shadow-xs flex outline-primary dark:outline-primary/30 outline-2 select-none " + (full ? "w-full justify-center" : "w-fit")}>
            <FancySwitchBase
                options={options}
                value={selectedOption}
                onChange={setSelectedOption}
                className={"flex w-fit h-full text-sm text-primary " + (children ? " pr-1 " : "") + (vertical ? " flex-col py-2" : "")}
                highlighterClassName={"transition-none h-full " + roundedClass + (showHighlight ? " bg-primary" : " bg-transparent")}
                radioClassName="relative mx-2 flex h-full cursor-pointer items-center justify-center rounded-full px-3.5 text-sm text-primary-foreground transition-colors focus:outline-hidden data-[checked]:text-primary-foreground"
                highlighterIncludeMargin={true}
                highlighterStyle={{ transitionProperty: animated ? "all" : "none" }}
                renderOption={({ option, isSelected, getOptionProps }) => (
                    <div {...getOptionProps()}
                        className={cn("flex items-center gap-2 z-50 justify-center hover:dark:text-white ", vertical ? " px-3" : " px-4 ", isSelected && showHighlight ? " text-white dark:text-white" : "", option.value === options.slice(-1)[0].value ? "rounded-full" : "")}>
                        {option.icon ? <span className='fancy-switch-icon'>{option.icon}</span> : ""}
                        <span className='fancy-switch-label'>{option.label}</span>
                    </div>
                )}
            />
            {children}
        </div>
    );
}