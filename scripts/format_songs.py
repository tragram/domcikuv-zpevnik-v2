import os
import re
from pathlib import Path

from utils import extract_metadata, filename_stem, songs_path


def remove_whitespaces(chordpro_lines: str):
    return [re.sub(" +", " ", l.strip()).replace("] ", "]") for l in chordpro_lines]


def replace_repetitions(chordpro_content: str):
    pattern = r"\|:([^{}]+?):\|"

    # Function to replace matches with the repetition symbols
    def replacer(match):
        content = match.group(1).strip()
        return f"𝄆 {content} 𝄇"

    # Replace all occurrences within the content
    return re.sub(pattern, replacer, chordpro_content)


def capitalize_lyrics(text):
    def capitalize_paragraph(match):
        # Match group 1 contains the chords or directives, group 2 contains the lyrics
        directive_or_emptyline = match.group(1) or ""  # Ensure it's a string
        chord = match.group(2) or ""  # Ensure it's a string
        lyrics = match.group(3) or ""  # Ensure it's a string

        # Capitalize the first non-whitespace letter in the lyrics
        capitalized_lyrics = re.sub(
            r"(?<!\S)(\S)", lambda m: m.group(1).upper(), lyrics, count=1
        )

        return directive_or_emptyline + chord + capitalized_lyrics

    def skip_tabs(match):
        # Return the entire match unmodified
        return match.group(0)

    # Regex matches chords/directives at the start of a line and lyrics afterward
    pattern = re.compile(
        r"((?:^|\n)\s*(?:\{[^}]*\}\s*|\n)\s*)(\[[A-Ha-h0-9#mi\s]\])?([^\n]*)"
    )

    # TODO: this does not work yet...
    # Match anything within {start_of_tab} and {end_of_tab}
    tab_pattern = re.compile(r"\{start_of_tab\}.*?\{end_of_tab\}", re.DOTALL)

    # First, protect tab sections from being modified
    text = tab_pattern.sub(skip_tabs, text)

    # Process the text to capitalize the lyrics for each paragraph
    return pattern.sub(capitalize_paragraph, text)


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
