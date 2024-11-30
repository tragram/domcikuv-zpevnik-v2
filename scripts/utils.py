import re
import unicodedata
from pathlib import Path


def songs_path():
    return Path(__file__).parent / "../songs"


def normalize_string(input_str):
    """Convert a string to ASCII and replace spaces with underscores."""
    # Convert to closest ASCII representation using unidecode
    nfkd_form = unicodedata.normalize("NFD", input_str)
    ascii_str = re.sub(r"[\u0300-\u036f]", "", nfkd_form)
    # Replace spaces with underscores
    ascii_str = ascii_str.replace(" ", "_").replace("?", "").replace("/", "")
    return ascii_str


def filename_stem(artist, title):
    return f"{normalize_string(artist)}-{normalize_string(title)}"


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


def load_chordpro_file(filepath):
    # Read the file content
    with open(filepath, "r", encoding="utf8") as file:
        content = file.read()
    return content


def remove_chordpro_directives(content):
    # Remove ChordPro directives (anything inside curly or square brackets brackets)
    content = re.sub(r"\{.*?\}", "", content)
    content = re.sub(r"\[.*?\]", "", content)
    content = re.sub(r"[ ]+", " ", content)
    content = re.sub(r"\n{3,}", "\n\n", content)
    return content.strip()


def get_lyrics(chordpro_file):
    content = load_chordpro_file(chordpro_file)
    return remove_chordpro_directives(content)


def check_if_lyrics_present(chordpro_filepath):
    """
    Checks if there are any lyrics (non-directive, non-chord) in the content.
    """
    # Split the content into lines
    print(chordpro_filepath)
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
