
import { FancySwitch as FancySwitchBase } from '@omit/react-fancy-switch'
export default function FancySwitch({ options, selectedOption, setSelectedOption, children, vertical = false }) {
    return (
        <div className={"h-full rounded-full transition-all shadow-sm flex " + (vertical ? " bg-white/70 backdrop-blur-xl " : "bg-primary/10 ")}>
            <FancySwitchBase
                options={options}
                value={selectedOption}
                onChange={setSelectedOption}
                className={"flex w-fit h-full text-sm text-muted-foreground " + (children ? " pr-1 " : "") + (vertical ? " flex-col py-2" : "")}
                highlighterClassName="bg-primary rounded-l-full h-full"
                radioClassName="relative mx-2 flex h-full cursor-pointer items-center justify-center rounded-full px-3.5 text-sm text-primary-foreground transition-colors focus:outline-none data-[checked]:text-primary-foreground"
                highlighterIncludeMargin={true}
                renderOption={({ option, isSelected, getOptionProps }) => (
                    <div {...getOptionProps()}
                        className={"flex items-center gap-2 z-50 justify-center" + (vertical ? " px-3" : " px-4 ") + (isSelected ? " text-primary-foreground" : "")}>
                        {option.icon ? <span className='fancy-switch-icon'>{option.icon}</span> : ""}
                        <span className='fancy-switch-label'>{option.label}</span>
                    </div>)
                }
            />
            {children}
        </div>
    )
}