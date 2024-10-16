import os
from pathlib import Path

import unidecode
from utils import extract_metadata, normalize_string, songs_path


def remove_whitespaces(file_path: Path):
    with open(file_path, "r", encoding="utf-8") as file:
        cleaned_lines = [
            l.strip().replace("] ", "]".replace("  ", " ")) for l in file.readlines()
        ]
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines("\n".join(cleaned_lines))


def format_chordpro_files(directory: Path):
    # Walk through the given directory
    for file_path in directory.glob("*.pro"):
        # Extract artist and title from the file
        remove_whitespaces(file_path)
        artist, title, _ = extract_metadata(file_path)

        # Only rename if both artist and title are found
        if artist and title:
            # Normalize artist and title to ASCII and replace spaces/non-alphanumeric chars
            artist_clean = normalize_string(artist)
            title_clean = normalize_string(title)

            # Create new file name in "artist-title.pro" format
            new_file_name = f"{artist_clean}-{title_clean}.pro"

            # Construct full path for the new file name
            new_file_path = file_path.parents[0] / new_file_name

            # Rename the file
            # os.rename(file_path, new_file_path)
            print(f"Renamed: '{file_path}' -> '{new_file_path}'")
        else:
            print(f"Metadata not found for '{file_path}', skipping.")


# Directory containing the song files
songs_directory = songs_path() / "chordpro"

# Call the function to rename the ChordPro files
format_chordpro_files(songs_directory)
