import React, { useState, useEffect } from 'react';
//TODO: select should have a default value
function SongFilter({ text, choices, setSelection }) {
    return (
        <select className="select select-bordered d" onChange={(e) => setSelection(e.target.value)}>
            <option key="description" disabled>{text}</option>
            {choices.map((choice) => (
                <option key={text + choice.value} value={choice.value}>{choice.text}</option>
            ))}
        </select>
    )
}

export default SongFilter;