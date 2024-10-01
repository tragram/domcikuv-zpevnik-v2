import React, { useState, useEffect } from 'react';
import { Select, SelectSection, SelectItem } from "@nextui-org/select";
//TODO: icon for language in searchbar and possibly avatars https://nextui.org/docs/components/select
function SongFilter({ text, choices, setSelection }) {
    return (
        <Select label={text} className="max-w-xs" size="sm" onChange={(e) => {console.log(e.target.value);setSelection(e.target.value)}}>
            {choices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value} >{choice.text}</SelectItem>
            ))} 
        </Select>
        //  <select className="select select-bordered d" onChange={(e) => setSelection(e.target.value)}>
        //     <option key="description" disabled>{text}</option>
        // </select>
    )
}

export default SongFilter;