import { Button } from '@nextui-org/react';
import { Dices } from 'lucide-react';
import React from 'react';
//TODO: select should have a default value
function Randomize({ filteredSongs, setSelectedSong }) {
    function selectSong() {
        setSelectedSong(filteredSongs[Math.floor(Math.random() * filteredSongs.length)])
    }
    return (
        <Button color="primary" isIconOnly onClick={selectSong} variant="ghost">
            <Dices />
        </Button>
    )
}

export default Randomize;