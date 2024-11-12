export default function CircularProgress({ value, maxValue, color, strokeWidth = 10 }) {
    return (
        <div className="block relative items-center justify-center h-10 w-10">
            <svg className="w-full h-full relative overflow-visible" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke={"#e5e7eb"} strokeWidth={strokeWidth} />
                <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="transition-all !duration-500 progress"
                    fill="transparent"
                    transform="rotate(-90 50 50)"
                    stroke={color && value ? color : "hsl(var(--primary))"}
                    strokeWidth={strokeWidth*1.2}
                    strokeDasharray="251.3"
                    strokeDashoffset={251.3 * (1 - value / maxValue)}
                    strokeLinecap="round"
                    role="progressbar" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-normal text-[0.65rem] text-muted-foreground">
                {value}
            </div>
        </div>
    )
}