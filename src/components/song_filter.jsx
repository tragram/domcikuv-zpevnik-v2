import React, { useState, useEffect } from 'react';

function SongFilter({ choices, setSelection }) {
    return (
        <select className="select select-bordered d" onChange={(e)=>setSelection(e.target.value)}>
            <option disabled selected>Language</option>
            {choices.map((choice) => (
                <option value={choice}>{choice}</option>
            ))}
        </select>
    )
}

export default SongFilter;