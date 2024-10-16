import re
from pathlib import Path

import unidecode


def songs_path():
    return Path("../songs")


def normalize_string(input_str):
    """Convert a string to ASCII and replace spaces with underscores."""
    # Convert to closest ASCII representation using unidecode
    ascii_str = unidecode.unidecode(input_str)
    # delete any non-alphanumeric characters
    ascii_str = "".join(
        char if char.isalnum() or char == " " else "" for char in ascii_str
    )
    # Replace spaces with underscores
    ascii_str = ascii_str.replace(" ", "_")
    return ascii_str


def get_directive(content, directive_name):
    """
    Extracts a specific directive (e.g., title, artist) from the ChordPro content.
    """
    pattern = re.compile(r"\{" + directive_name + r":\s*(.*?)\}")
    match = pattern.search(content)
    if match:
        return match.group(1).strip()
    return None


def extract_metadata(file_path):
    """Extract artist and title from a ChordPro (.pro) file."""
    artist = None
    title = None
    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()

    title = get_directive(content, "title")
    artist = get_directive(content, "artist")
    key = get_directive(content, "key")

    return artist, title, key


def check_if_lyrics_present(chordpro_filepath):
    """
    Checks if there are any lyrics (non-directive, non-chord) in the content.
    """
    # Split the content into lines
    with open(chordpro_filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

        for line in lines:
            # Skip lines that are purely directives (e.g., {title: ...}, {artist: ...}, etc.)
            if re.match(r"^\{.*\}$", line.strip()):
                continue

            # If there's anything that isn't a directive and isn't empty, assume it's lyrics
            if line.strip():  # Any non-empty line that isn't a directive
                return True

        return False
