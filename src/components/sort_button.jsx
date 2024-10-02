import { useState, useEffect } from "react";
import { Button } from "@nextui-org/react";
import { ChevronDown, ChevronUp } from "lucide-react";
function SortButton({ text, field, songFiltering, setSongFiltering, onClick }) {
    function changeState() {
        if (isActive()) {
            const currentSortType = songFiltering.sortType;
            setSongFiltering({
                ...songFiltering,
                sortType: currentSortType == "ascending" ? "descending" : "ascending",
                sortByField: field,
            });
        }
        else {
            setSongFiltering({
                ...songFiltering,
                sortByField: field,
            });
        }
    }

    function isActive() {
        return songFiltering.sortByField == field;
    }

    let chevron = songFiltering.sortType == "ascending" ? <ChevronUp /> : <ChevronDown />

    return (<>
        <Button color="primary" variant={isActive() ? 'solid' : 'ghost'} size="md" className="max-w-24" onClick={() => { changeState(); onClick() }} endContent={chevron}>{text}</Button>
    </>
    )
}

export default SortButton;