import { useState, useEffect } from "react";
import { Check, AudioLines, MicVocal, CalendarPlus, AArrowUp, AArrowDown, ArrowDown01, ArrowDown10, ArrowDownAZ, ArrowDownZA } from "lucide-react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownSection, DropdownItem, Button, cn } from "@nextui-org/react";

function SortButtonMobile({ songFiltering, setSongFiltering, }) {
    function selectSortField(key) {
        if (key.includes("_sort")) {
            selectSortType(key.slice(0, -5));
        } else {
            setSongFiltering({
                ...songFiltering,
                sortByField: key
            });
        }
    }

    function selectSortType(key) {
        console.log(key)
        setSongFiltering({
            ...songFiltering,
            sortType: key
        });
    }

    function sortingIcon(field, type) {
        if (field === "date_added") {
            if (type === "descending") {
                return <ArrowDown10 />
            } else {
                return <ArrowDown01 />
            }
        } else if ((field === "title" | field === "artist")) {
            if (type === "descending") {
                return <ArrowDownZA />
            } else {
                return <ArrowDownAZ />
            }
        }
    }

    return (<>
        <Dropdown closeOnSelect={false}>
            <DropdownTrigger>
                <Button
                    variant="ghost"
                    color="primary"
                >
                    Sorting
                </Button>
            </DropdownTrigger>
            <DropdownMenu variant="faded" aria-label="Dropdown menu with description" onAction={(key) => selectSortField(key)}>
                <DropdownSection title="Sorting method" showDivider>
                    <DropdownItem key="title" startContent={<AudioLines />}
                        endContent={songFiltering.sortByField === "title" ? <Check /> : ""}>
                        Song title
                    </DropdownItem>
                    <DropdownItem key="artist" startContent={<MicVocal />}
                        endContent={songFiltering.sortByField === "artist" ? <Check /> : ""}
                    >
                        Artist
                    </DropdownItem>
                    <DropdownItem key="date_added" startContent={<CalendarPlus />}
                        endContent={songFiltering.sortByField === "date_added" ? <Check /> : ""}
                    >
                        Date
                    </DropdownItem>
                </DropdownSection>
                <DropdownSection title="Direction" >
                    <DropdownItem
                        key="ascending_sort"
                        startContent={sortingIcon(songFiltering.sortByField, "ascending")}
                        endContent={songFiltering.sortType === "ascending" ? <Check /> : ""}
                    >
                        Ascending
                    </DropdownItem>
                    <DropdownItem
                        key="descending_sort"
                        startContent={sortingIcon(songFiltering.sortByField, "descending")}
                        endContent={songFiltering.sortType === "descending" ? <Check /> : ""}
                    >
                        Descending
                    </DropdownItem>
                </DropdownSection>
            </DropdownMenu>
        </Dropdown>
        {/* <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"></link>
        <Button color="primary" variant={isActive() ? 'solid' : 'ghost'} size="md" className="max-w-24" onClick={() => { changeState(); onClick() }} endContent={chevron}>{text}</Button> */}
    </>

    );
}

export default SortButtonMobile;