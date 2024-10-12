import os

import unidecode


def extract_metadata(file_path):
    """Extract artist and title from a ChordPro (.pro) file."""
    artist = None
    title = None

    with open(file_path, "r", encoding="utf-8") as file:
        cleaned_lines = [
            l.strip().replace("] ", "]".replace("  ", " ")) for l in file.readlines()
        ]
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines("\n".join(cleaned_lines))

    for line in cleaned_lines:
        # Find the title from the line, e.g., {title: Song Title}
        if line.startswith("{title:"):
            title = line[len("{title:") :].rstrip("}")
            title = title.strip()

        # Find the artist from the line, e.g., {artist: Artist Name}
        if line.startswith("{artist:"):
            artist = line[len("{artist:") :].rstrip("}")
            artist = artist.strip()

        # Stop early if both artist and title are found
        if artist and title:
            break

    return artist, title


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


def format_chordpro_files(directory):
    # Walk through the given directory
    for root, dirs, files in os.walk(directory):
        for file in files:
            # Check if the file has a .pro extension
            if file.endswith(".pro"):
                # Get the full file path
                file_path = os.path.join(root, file)

                # Extract artist and title from the file
                artist, title = extract_metadata(file_path)

                # Only rename if both artist and title are found
                if artist and title:
                    # Normalize artist and title to ASCII and replace spaces/non-alphanumeric chars
                    artist_clean = normalize_string(artist)
                    title_clean = normalize_string(title)

                    # Create new file name in "artist-title.pro" format
                    new_file_name = f"{artist_clean}-{title_clean}.pro"

                    # Construct full path for the new file name
                    new_file_path = os.path.join(root, new_file_name)

                    # Rename the file
                    os.rename(file_path, new_file_path)
                    print(f"Renamed: '{file_path}' -> '{new_file_path}'")
                else:
                    print(f"Metadata not found for '{file_path}', skipping.")


# Directory containing the song files
songs_directory = "songs/chordpro"

# Call the function to rename the ChordPro files
format_chordpro_files(songs_directory)
