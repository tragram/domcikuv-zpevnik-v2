import React, { useState, useEffect } from 'react';
import dieImage from '/src/assets/die.svg'
import { Button } from '@nextui-org/react';
//TODO: select should have a default value
function Randomize({ filteredSongs, setSelectedSong }) {
    function selectSong() {
        setSelectedSong(filteredSongs[Math.floor(Math.random() * filteredSongs.length)])
    }
    return (
        <Button isIconOnly color="primary" variant="ghost" onClick={selectSong}>
            <img src={dieImage} className="h-6 w-6 fill-white"
                viewBox="0 0 24 24" />
        </Button>
    )
}

export default Randomize;