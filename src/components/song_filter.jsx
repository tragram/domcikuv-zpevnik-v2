import React, { useState, useEffect } from 'react';

function SongFilter({ text, choices, setSelection }) {
    return (
        <select className="select select-bordered d" onChange={(e)=>setSelection(e.target.value)}>
            <option disabled selected>{text}</option>
            {choices.map((choice) => (
                <option value={choice.value}>{choice.text}</option>
            ))}
        </select>
    )
}

export default SongFilter;