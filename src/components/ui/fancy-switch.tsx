
import { FancySwitch as FancySwitchBase } from '@omit/react-fancy-switch'
export default function FancySwitch({ options, selectedOption, setSelectedOption, children }) {
    return (
        <div className="h-full rounded-full bg-primary/10 shadow-sm flex">
            <FancySwitchBase
                options={options}
                value={selectedOption}
                onChange={setSelectedOption}
                className={"flex w-fit h-full " + (children ? "pr-1" : "")}
                highlighterClassName="bg-primary rounded-full h-full"
                radioClassName="relative mx-2 flex h-full cursor-pointer items-center justify-center rounded-full px-3.5 text-sm font-medium transition-colors focus:outline-none data-[checked]:text-primary-foreground"
                highlighterIncludeMargin={true}
                renderOption={({ option, isSelected, getOptionProps }) => (
                    <div {...getOptionProps()} className="flex items-center gap-2 z-50 px-4">
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                    </div>
                )}
            />
            {children}
        </div>
    )
}