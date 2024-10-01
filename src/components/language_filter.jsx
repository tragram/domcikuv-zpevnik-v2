import React, { useState, useEffect } from 'react';
import { Select, SelectSection, SelectItem } from "@nextui-org/select";
import LanguageFlag from './language_flag';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button, RadioGroup, Radio } from "@nextui-org/react";
//TODO: icon for language in searchbar and possibly avatars https://nextui.org/docs/components/select
function LanguageFilter({ text, choices, selectedLanguage, setSelectedLanguage }) {
    console.log(selectedLanguage)
    return (
        <Dropdown >
            <DropdownTrigger>
                <Button size="x-small" color="primary" variant={selectedLanguage == "all" ? "ghost" : "solid"}>{text}</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Language Choices" onAction={(key) => setSelectedLanguage(key)}>
                {choices.map((choice) => (
                    <DropdownItem key={choice.value} startContent={<LanguageFlag language={choice.text} />}>{choice.text}</DropdownItem>
                ))}
            </DropdownMenu>
        </Dropdown>
    )
}

export default LanguageFilter;