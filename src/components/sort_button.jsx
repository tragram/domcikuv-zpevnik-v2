import { useState, useEffect } from "react";
import { Button } from "@nextui-org/react";
function SortButton({ text, field, songFiltering, setSongFiltering, onClick }) {
    let checkboxID = () => { return field + "checkbox" }
    let sortButtonID = () => { return field + "sortButton" }
    const [checkboxState, setCheckboxState] = useState(startCheckboxState)
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
    let chevron = <i className={`fa fa-chevron-${checkboxState ? 'up' : 'down'}`} ></i>

    return (<>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"></link>
        <Button color="primary" variant={isActive() ? 'solid' : 'ghost'} onClick={() => { changeState(); onClick() }} endContent={chevron}>{text}</Button>
    </>
    )
}

export default SortButton;