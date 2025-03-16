import os
import re
from pathlib import Path
from typing import Mapping

import anthropic
import yaml
from utils import load_secrets, songs_path

secrets = load_secrets()
client = anthropic.Anthropic(
    api_key=secrets["anthropic"]["api_key"],
)

system_message = """When presented with a song in ChordPro format that has repeated sections with missing chords, complete the following tasks:

* Add chord annotations only where lyrics already exist and chords are missing.
* For repeated sections (verse/chorus/bridge etc.), copy the chord progression from the first occurrence of that section type.
* If you detect a key change/modulation, transpose the chords appropriately while maintaining the same relative chord progression.
* Preserve all existing ChordPro directives (e.g. {chorus}, {verse}) without expanding or modifying them.
* Only output the updated ChordPro file contents with no additional commentary.

Important notes:
* Do not add or modify any lyrics.
* Do not expand section directives.
* Only add chords where there are existing lyrics missing chord annotations.
* Maintain the original formatting and structure.
* If unsure about a chord progression, flag it for review.
* Do not abbreviate the output. Replacing parts of the song with e.g. "[the same chords here]" is unacceptable."""

model_id = "claude-3-5-sonnet-20241022"
batches_folder = Path(__file__).parent.resolve() / "batches"


def antropic_id_sanitization(input_string):
    sanitized = re.sub(r"[^a-zA-Z0-9_-]", "", input_string)
    return sanitized[:64]


def generate_chords(chordpro_content: str):
    message = client.messages.create(
        model=model_id,
        max_tokens=1500,
        temperature=0,
        system=system_message,
        messages=[
            {"role": "user", "content": [{"type": "text", "text": chordpro_content}]}
        ],
    )
    return message.content[0].text


def generate_chords_batch_api(chordpro_contents: Mapping[str, str]):
    chordpro_contents = [(d["antropic_id"], d["content"]) for d in chordpro_contents]
    message_batch = client.beta.messages.batches.create(
        requests=[
            {
                "custom_id": song_id,
                "params": {
                    "model": model_id,
                    "max_tokens": 1500,
                    "temperature": 0,
                    "system": system_message,
                    "messages": [
                        {
                            "role": "user",
                            "content": chordpro_content,
                        }
                    ],
                },
            }
            for (song_id, chordpro_content) in chordpro_contents
        ]
    )
    return message_batch


def find_incomplete_chordpro_files(folder_path, skipping, max_songs=10, batch_api=True):
    """
    Finds all ChordPro files in a folder where some verses lack chords.

    Args:
        folder_path (str): Path to the folder containing ChordPro files.

    Returns:
        list: List of file names with incomplete chords.
    """
    incomplete_files = []

    # Regular expressions to identify chords and section labels
    chord_pattern = re.compile(r"\[.+\]")
    section_start_pattern = re.compile(r"\{start_of_(verse|chorus|bridge)(:[^}]*)?\}")
    section_end_pattern = re.compile(r"\{end_of_(verse|chorus|bridge)\}")
    rec_label_pattern = re.compile(r":\s*rec\.", re.IGNORECASE)

    processed_songs = 0
    for file_name in os.listdir(folder_path):
        if file_name in skipping:
            print(f"Skipping {file_name} - already in batch API queue...")
            continue
        if processed_songs >= max_songs:
            break
        if file_name.endswith(".pro") or file_name.endswith(".chordpro"):
            file_path = os.path.join(folder_path, file_name)

            with open(file_path, "r", encoding="utf-8") as file:
                content = file.read()

            # Find all sections (start and end markers)
            sections = []
            start_matches = list(section_start_pattern.finditer(content))
            end_matches = list(section_end_pattern.finditer(content))

            if len(start_matches) == len(end_matches):
                for start_match, end_match in zip(start_matches, end_matches):
                    label = start_match.group(0)  # e.g., "{start_of_verse: Rec.}"
                    if rec_label_pattern.search(label):  # Skip sections with "Rec."
                        print(f"Skipping section in {file_name} due to 'Rec.' label.")
                        continue
                    sections.append(content[start_match.end() : end_match.start()])

            # Check if any section lacks chords and process it
            for section in sections:
                if not chord_pattern.search(section):  # Check if chords are missing
                    print("Would like to add chords to ", file_name)
                    incomplete_files.append(
                        {
                            "file_name": file_name,
                            "content": content,
                            "antropic_id": antropic_id_sanitization(file_name),
                        }
                    )
                    if batch_api:
                        pass
                    else:
                        updated_content = generate_chords(content)
                        with open(file_path, "w", encoding="utf-8") as file:
                            file.write(updated_content)
                    processed_songs += 1
                    break

    message_batch = generate_chords_batch_api(incomplete_files)
    print(message_batch)
    with open(
        batches_folder / (message_batch.id + ".yaml"), "w", encoding="utf-8"
    ) as file:
        yaml.safe_dump(incomplete_files, file)
    return incomplete_files


def check_all_past_batches():
    def find_song_with_id(songs, id):
        for song in songs:
            if song["antropic_id"] == id:
                return song
        raise ValueError("Unknown ID!")

    files = [f for f in Path(batches_folder).iterdir() if f.is_file()]
    skipping = []
    for file_path in files:
        with open(file_path, "r", encoding="utf-8") as file:
            songs = yaml.safe_load(file)
        skipping.extend([s["file_name"] for s in songs])
        message_batch = client.beta.messages.batches.retrieve(
            file_path.stem,
        )
        should_delete = True
        if message_batch.processing_status == "ended":
            for result in client.beta.messages.batches.results(
                file_path.stem,
            ):
                match result.result.type:
                    case "succeeded":
                        song = find_song_with_id(songs, result.custom_id)
                        with open(
                            songs_path() / "chordpro" / song["file_name"],
                            "w",
                            encoding="utf-8",
                        ) as f:
                            f.write(result.result.message.content[0].text)
                    case "errored":
                        if result.result.error.type == "invalid_request":
                            print(f"Validation error {result.custom_id}")
                        else:
                            print(f"Server error {result.custom_id}")
                        should_delete = False
                    case "expired":
                        print(f"Request expired {result.custom_id}")
                        should_delete = False
            if should_delete:
                Path.unlink(file_path)
        else:
            print(
                f"Batch {message_batch.id} processing status is {message_batch.processing_status}"
            )
    return skipping


if __name__ == "__main__":
    skipping = check_all_past_batches()
    folder_path = songs_path() / "chordpro"

    if not os.path.exists(folder_path):
        print("The specified folder does not exist.")
    else:
        incomplete_files = find_incomplete_chordpro_files(folder_path, skipping)

        if incomplete_files:
            print(
                f"The following files have verses without chords ({len(incomplete_files)} in total):"
            )
            for file_name in incomplete_files:
                print(f"- {file_name}")
        else:
            print("All ChordPro files have chords in all verses.")
