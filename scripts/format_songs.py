import os
import re
from pathlib import Path

from utils import extract_metadata, filename_stem, songs_path


def remove_whitespaces(file_path: Path):
    with open(file_path, "r", encoding="utf-8") as file:
        cleaned_lines = [
            re.sub(" +", " ", l.strip()).replace("] ", "]") for l in file.readlines()
        ]
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines("\n".join(cleaned_lines))


def rename_file_in_directory(
    directory: Path, old_stem: str, new_stem: str, extension: str
):
    old_path = directory / (old_stem + extension)
    if old_path.exists():
        print(f"Renaming in {directory}: {old_stem+extension} --> {new_stem+extension}")
        old_path.rename(directory / (new_stem + extension))
    else:
        f"Path {old_path} does not exist"


def format_chordpro_files(
    song_directory: Path, chordpro_folder, other_folders: list[tuple[str, str]] = None
):
    # Walk through the given directory
    directory = song_directory / chordpro_folder
    for file_path in directory.glob("*.pro"):
        # Extract artist and title from the file
        remove_whitespaces(file_path)
        artist, title, _ = extract_metadata(file_path)

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
    ("image_prompts", ".yaml"),
    ("scraped", ".txt"),
]
# Call the function to rename the ChordPro files
format_chordpro_files(songs_directory, "chordpro", other_folders)
