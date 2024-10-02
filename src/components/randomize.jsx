import React, { useState, useEffect } from 'react';
import { Dices } from 'lucide-react';
import { Button } from '@nextui-org/react';
//TODO: select should have a default value
function Randomize({ filteredSongs, setSelectedSong }) {
    function selectSong() {
        setSelectedSong(filteredSongs[Math.floor(Math.random() * filteredSongs.length)])
    }
    return (
        <Button isIconOnly color="primary" variant="ghost" onClick={selectSong}>
            <Dices />
        </Button>
    )
}

export default Randomize;