
import { FancySwitch as FancySwitchBase } from '@omit/react-fancy-switch'
export default function FancySwitch({ options, selectedOption, setSelectedOption }) {
    return (
        <FancySwitchBase
            options={options}
            value={selectedOption}
            onChange={setSelectedOption}
            className="flex w-fit h-full pr-1"
            highlighterClassName="bg-primary rounded-full h-full"
            radioClassName="relative mx-2 flex h-full cursor-pointer items-center justify-center rounded-full px-3.5 text-sm font-medium transition-colors focus:outline-none data-[checked]:text-primary-foreground"
            highlighterIncludeMargin={true}
        />
    )
}