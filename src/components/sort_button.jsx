import { useState } from "react";

function SortButton({ text, field, songFiltering, setSongFiltering, onClick }) {
    let checkboxID = () => { return field + "checkbox" }
    let sortButtonID = () => { return field + "sortButton" }
    function changeState() {
        // the setState function is async, so need to get a copy that will track the true value for later
        // TODO: this is certainly not the best solution
        let trueCheckboxState = checkboxState;
        if (isActive()) {
            setCheckboxState(!checkboxState);
            trueCheckboxState = !trueCheckboxState;
        }
        setSongFiltering({
            ...songFiltering,
            sortType: trueCheckboxState ? "descending" : "ascending",
            sortByField: field,
        })
    }

    function isActive() {
        // console.log("is active: " + songFiltering.sortByField + "-" + field + "->" + String(songFiltering.sortByField == field))
        return songFiltering.sortByField == field;
    }

    function startCheckboxState() {
        console.log("using start state!")
        return (songFiltering.sortType == "descending")
    }

    const [checkboxState, setCheckboxState] = useState(startCheckboxState)
    return (<>
        <div className={`flex flex-row ${isActive() ? 'bg-primary' : ''}`}>
            <button id={sortButtonID()} onClick={() => { changeState(); onClick() }} >{text}</button >
            <label className="swap swap-rotate">
                {/* this hidden checkbox controls the state */}
                <input type="checkbox" id={checkboxID()} checked={checkboxState} onChange={(e) => { document.getElementById(sortButtonID()).click() }} />
                <svg className="swap-on h-3 w-3 fill-current" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
                    <path d="m599.09 538.08c-96.793 0-193.6 0.19141-290.39-0.20312-13.309-0.058594-26.879-1.8242-39.863-4.7891-34.871-7.9688-50.184-36.445-36.359-69.613 6.3008-15.098 15.277-29.867 25.992-42.227 87-100.44 174.52-200.43 262.39-300.1 10.895-12.359 23.902-23.375 37.5-32.746 27.203-18.793 56.316-19.512 82.957 0.20312 18.336 13.57 35.062 29.809 50.426 46.727 39.73 43.754 78.445 88.414 117.29 132.97 45.086 51.73 90.109 103.49 134.59 155.75 14.137 16.598 26.605 34.703 27.77 57.863 1.2227 24.406-9.4062 41.711-32.953 48.672-14.605 4.3203-30.203 7.0781-45.383 7.1875-98.004 0.61719-196 0.30469-293.97 0.30469z" />
                </svg>
                <svg className="swap-off h-3 w-3 fill-current" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
                    <path d="m600.1 661.92c96 0.011719 192-0.30078 288 0.3125 16.367 0.10938 33.254 2.375 48.973 6.8984 28.824 8.2695 42.672 33.48 31.766 61.391-7.6094 19.488-19.141 38.496-32.797 54.371-82.836 96.168-166.55 191.58-250.61 286.7-13.262 15.012-28.621 28.754-44.941 40.367-26.148 18.625-54.48 18.527-80.941 0.27734-14.555-10.043-28.512-21.793-40.188-35.016-86.879-98.438-173.24-197.33-259.37-296.43-9.5273-10.957-17.953-23.398-24.469-36.383-20.027-39.926-0.97266-74.555 43.477-79.883 13.703-1.668 27.602-2.4844 41.398-2.5078 93.242-0.20312 186.47-0.10547 279.7-0.10547z" />
                </svg>
            </label>
        </div>
    </>
    )
}

export default SortButton;