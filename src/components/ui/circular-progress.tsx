export default function CircularProgress({ value, maxValue, color, strokeWidth = 18 }) {
    return (
        <div className="flex items-center justify-center h-8 w-8">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke={"#e5e7eb"} strokeWidth={strokeWidth} />
                <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="url(#progress-gradient)"
                    strokeWidth={strokeWidth}
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 * (1 - value/maxValue)}
                />
                <defs>
                    <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#d2222d" />
                        <stop offset="50%" stopColor="#FFBF00" />
                        <stop offset="100%" stopColor="#238823" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute text-xs text-gray-900 dark:text-gray-50">
                {value}
            </div>
        </div>
    )
}