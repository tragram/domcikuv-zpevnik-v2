import re
from enum import Enum
from pathlib import Path
from typing import Tuple

from utils import check_if_lyrics_present, extract_metadata, songs_path


def is_chord_line(line):
    """
    Detects if a line is likely to be a chord line.
    Chord lines generally contain chord names like 'A', 'G#m', etc.
    """
    # Check if the line contains mostly uppercase letters and spaces
    # Also check for typical chord symbols like A, G#m, etc.
    chord_pattern = re.compile(r"[A-H][#bs]?m?[mi]?[5-7]?")

    # Count possible chord matches
    chords = chord_pattern.findall(line)

    # If a significant portion of the line consists of chord names, assume it's a chord line
    return len(chords) > 0 and len(chords) >= len(line.split()) / 2


def tokenize_with_positions(text):
    """
    Tokenizes a string into words and spaces, while keeping track of their start positions.
    Returns a list of tuples: (token, start_position).
    """
    tokens = []
    for match in re.finditer(r"\S+", text):  # Match any non-space sequence
        tokens.append((match.group(), match.start()))
    return tokens


def place_chord(chord_token, lyric_token) -> tuple[str, bool]:
    # returns the string and if it placed the chord, True as second return
    word, word_start_pos = lyric_token
    chord, chord_pos = chord_token

    # even if the word fits, force the chords in front of prepositions ()
    if chord_pos - (word_start_pos + len(word)) >= 0:
        return f"{word} ", False
    # move the chords at the start of word
    elif chord_pos - word_start_pos <= 2 or (
        chord_pos - word_start_pos <= 3 and len(word) == 3
    ):
        return f"[{chord}]{word} ", True
    else:
        word_split_idx = chord_pos - word_start_pos
        return f"{word[:word_split_idx]}[{chord}]{word[word_split_idx:]} ", True


def insert_chords_in_lyrics(chord_line, lyric_line):
    """
    Inserts chords into the lyrics at the correct positions based on word boundaries.
    If the chord position is within 2 characters of the word's start, the chord is placed before the word.
    """
    result = []

    # Tokenize the lyrics into words and track their positions
    lyric_tokens = tokenize_with_positions(lyric_line)

    # Find all chords and their positions in the chord line
    chord_tokens = [(m.group(), m.start()) for m in re.finditer(r"\S+", chord_line)]
    token_index = 0  # Track the current word in the lyrics
    for chord_token in chord_tokens:
        # Ensure we don't overshoot the lyric length
        if token_index >= len(lyric_tokens):
            result.append(
                f"[{chord_token[0]}]"
            )  # Append any remaining chords if they are after the lyrics
            continue

        chord_placed = False
        while not chord_placed and token_index < len(lyric_tokens):
            ret, chord_placed = place_chord(chord_token, lyric_tokens[token_index])
            token_index += 1
            result.append(ret)

    # Add any remaining lyric tokens after all chords have been inserted
    if token_index < len(lyric_tokens):
        for word, _ in lyric_tokens[token_index:]:
            result.append(word + " ")
    return "".join(result)


def group_lines_into_paragraphs(song_lines):
    """
    Groups song lines into paragraphs
    """
    paragraphs = []
    paragraph = []

    for line in song_lines:
        if line.strip() == "":
            if paragraph:
                paragraphs.append(paragraph)
                paragraph = []
        else:
            paragraph.append(line)

    if paragraph:
        paragraphs.append(paragraph)

    return paragraphs


def add_chordpro_directives(paragraph):
    """
    Adds ChordPro directives based on verse and chorus markers.
    """
    output_lines = []

    if len(paragraph) == 0:
        return ""
    first_line = paragraph[0].strip()

    # Detect verses (e.g., "1. ", "2. ")
    verse_match = re.match(r"\d+\.\s", first_line)
    chorus_match = re.match(r"R\d*:\s*", first_line)
    bridge_match = re.match(r"B\d*:\s*", first_line)
    if verse_match:
        output_lines.append("{start_of_verse}")
        for line in paragraph:
            # Remove the verse number from the first line
            if line == paragraph[0]:
                output_lines.append(line[len(verse_match.group()) :].strip())
            else:
                output_lines.append(line)
        output_lines.append("{end_of_verse}")

    # Detect choruses (e.g., "R: ")
    elif chorus_match:
        if first_line == chorus_match.group():
            output_lines.append("{chorus}")
        else:
            output_lines.append("{start_of_chorus}")
            for line in paragraph:
                # Remove "R: " from the first line of the chorus
                if line == paragraph[0]:
                    output_lines.append(line[len(chorus_match.group()) :].strip())
                else:
                    output_lines.append(line)
            output_lines.append("{end_of_chorus}")

        # Append other paragraphs as is
    elif bridge_match:
        if first_line == bridge_match.group():
            output_lines.append("{bridge}")
        else:
            output_lines.append("{start_of_bridge}")
            for line in paragraph:
                # Remove the bridge number from the first line
                if line == paragraph[0]:
                    output_lines.append(line[len(bridge_match.group()) :].strip())
                else:
                    output_lines.append(line)
            output_lines.append("{end_of_bridge}")

    else:
        output_lines.extend(paragraph)

    return output_lines


def process_paragraph(song_lines):
    """
    Processes an entire song by detecting chord and lyric lines, inserting chords into the lyrics,
    and adding ChordPro directives for verses and choruses.
    """
    chordpro_result = []
    chord_line = None
    structured_song = []

    for line in song_lines:
        if is_chord_line(line):
            chord_line = line  # Save the chord line for the next lyric line
        else:
            if chord_line:  # If we have a chord line, match it with the lyric line
                chordpro_line = insert_chords_in_lyrics(chord_line, line)
                structured_song.append(chordpro_line)
                chord_line = None  # Reset chord line after processing
            else:
                structured_song.append(
                    line.strip()
                )  # Add the lyric line if no chord line to match
    # Add ChordPro directives after processing the chords
    chordpro_result = add_chordpro_directives(structured_song)

    return "\n".join(chordpro_result)


def process_song(song_lines):
    paragraphs = group_lines_into_paragraphs(song_lines)
    result = []
    for paragraph in paragraphs:
        processed = process_paragraph(paragraph)
        result.append(processed)
    return "\n\n".join(result)


def process_scraped_folder(folder_path: Path, n=5):
    """
    Walks through a folder and processes all ChordPro (.pro or .cho) files.

    """
    i = 0
    chordpro_files = list(folder_path.glob("*.txt"))
    for filepath in chordpro_files:
        if i >= n:
            break
        print("-" * 40)
        print(f"Processing {filepath}")
        chordpro_filepath = Path(f"songs/chordpro/{filepath.stem}.pro")
        if check_if_lyrics_present(chordpro_filepath):
            print(f"{chordpro_filepath} contains lyrics --> skipping")
            continue
        with open(filepath, "r", encoding="utf-8") as file:
            song_lines = file.readlines()
        if len(song_lines) <= 2:
            print("Empty file for", filepath, "--> skipping")
            continue

        chordpro_output = process_song(song_lines)
        print(chordpro_output)
        with open(chordpro_filepath, "a+", encoding="utf-8") as file:
            file.write("\n" + chordpro_output)
        i += 1


process_scraped_folder(songs_path() / "scraped")
