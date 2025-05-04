import os
import re
from pathlib import Path

from utils import extract_metadata, filename_stem, songs_path


def remove_whitespaces(chordpro_lines: str):
    return [
        re.sub(" +", " ", l.strip()).replace("] ", "]").replace("]𝄇", "] 𝄇")
        for l in chordpro_lines
    ]


def replace_repetitions(chordpro_content: str):
    pattern = r"\|:([^{}]+?):\|"

    # Function to replace matches with the repetition symbols
    def replacer(match):
        content = match.group(1).strip()
        return f"𝄆 {content} 𝄇"

    # Replace all occurrences within the content
    return re.sub(pattern, replacer, chordpro_content)


def capitalize_lyrics(text):
    import re

    # Pattern to match the tab sections
    tab_pattern = re.compile(r"\{start_of_tab\}.*?\{end_of_tab\}", re.DOTALL)
    # Pattern to match chords/directives and lyrics
    pattern = re.compile(
        r"((?:^|\n)\s*(?:\{[^}]*\}\s*|\n)\s*)(\[[A-Ha-h0-9#mi\s]*\])?([^\n]*)"
    )

    # Protect tab sections by replacing them with placeholders
    tabs = {}
    for i, match in enumerate(tab_pattern.finditer(text)):
        placeholder = f"__TAB_SECTION_{i}__"
        tabs[placeholder] = match.group(0)  # Store the tab content
        text = text.replace(match.group(0), placeholder)  # Replace with placeholder

    # Function to capitalize the first letter of lyrics
    def capitalize_paragraph(match):
        directive_or_emptyline = (
            match.group(1) or ""
        )  # ChordPro directives or empty lines
        chord = match.group(2) or ""  # Chords
        lyrics = match.group(3) or ""  # Lyrics

        # Capitalize the first non-whitespace character in the lyrics
        capitalized_lyrics = re.sub(
            r"(?<!\S)(\S)", lambda m: m.group(1).upper(), lyrics, count=1
        )
        return directive_or_emptyline + chord + capitalized_lyrics

    # Apply capitalization to the lyrics
    text = pattern.sub(capitalize_paragraph, text)

    # Restore the tab sections
    for placeholder, original_tab in tabs.items():
        text = text.replace(placeholder, original_tab)

    return text


def rename_file_in_directory(
    directory: Path, old_stem: str, new_stem: str, extension: str
):
    def is_empty(path):
        return not any(Path(path).iterdir())

    old_path = directory / (old_stem + extension)
    new_path = directory / (new_stem + extension)
    if new_path.is_dir() and is_empty(new_path):
        new_path.rmdir()
    if old_path.exists():
        print(f"Renaming in {directory}: {old_stem+extension} --> {new_stem+extension}")
        old_path.rename(new_path)
    else:
        f"Path {old_path} does not exist"


def format_chordpro_files(
    song_directory: Path, chordpro_folder, other_folders: list[tuple[str, str]] = None
):
    # Walk through the given directory
    directory = song_directory / chordpro_folder
    for file_path in directory.glob("*.pro"):
        # Extract artist and title from the file
        artist, title, _ = extract_metadata(file_path)

        with open(file_path, "r", encoding="utf-8") as file:
            chordpro_lines = file.readlines()
            chordpro_content = "\n".join(remove_whitespaces(chordpro_lines))
            chordpro_content = replace_repetitions(chordpro_content)
            chordpro_content = capitalize_lyrics(chordpro_content)
        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(chordpro_content)

        # Only rename if both artist and title are found
        if artist and title:
            new_stem = filename_stem(artist, title)
            new_file_name = directory / f"{new_stem}.pro"
            print(file_path, directory / new_file_name)
            if file_path != directory / new_file_name:
                print("-" * 40)
                print("Looking at file", file_path)
                new_file_path = file_path.rename(directory / new_file_name)
                for folder, extension in other_folders:
                    rename_file_in_directory(
                        song_directory / folder, file_path.stem, new_stem, extension
                    )
                print(f"Renamed: '{file_path}' -> '{new_file_path}'")
        else:
            print(f"Metadata not found for '{file_path}', skipping.")


# Directory containing the song files
songs_directory = songs_path()
other_folders = [
    ("illustrations", ""),
    ("illustrations_thumbnails", ""),
    ("image_prompts", ".yaml"),
    ("scraped", ".txt"),
]
# Call the function to rename the ChordPro files
format_chordpro_files(songs_directory, "chordpro", other_folders)
