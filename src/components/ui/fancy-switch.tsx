
import { FancySwitch as FancySwitchBase } from '@omit/react-fancy-switch'
export default function FancySwitch({ options, selectedOption, setSelectedOption, roundedClass, children, vertical = false, full = false }) {
    return (
        <div className={"h-full bg-white dark:bg-background/90 font-bold rounded-full transition-all shadow-sm flex outline-primary dark:outline-primary/30 outline-2 outline " + (full ? "w-full justify-center" : "w-fit")}>
            <FancySwitchBase
                options={options}
                value={selectedOption}
                onChange={setSelectedOption}
                className={"flex w-fit h-full text-sm text-primary " + (children ? " pr-1 " : "") + (vertical ? " flex-col py-2" : "")}
                highlighterClassName={"bg-primary h-full " + roundedClass}
                radioClassName="relative mx-2 flex h-full cursor-pointer items-center justify-center rounded-full px-3.5 text-sm text-primary-foreground transition-colors focus:outline-none data-[checked]:text-primary-foreground"
                highlighterIncludeMargin={true}
                renderOption={({ option, isSelected, getOptionProps }) => (
                    <div {...getOptionProps()}
                        className={"flex items-center gap-2 z-50 justify-center " + (vertical ? " px-3" : " px-4 ") + (isSelected ? " text-primary-foreground" : "") + (option == options.slice(-1)[0] ? "rounded-full" : "")}>
                        {option.icon ? <span className='fancy-switch-icon'>{option.icon}</span> : ""}
                        <span className='fancy-switch-label'>{option.label}</span>
                    </div>)
                }
            />
            {children}
        </div>
    )
}