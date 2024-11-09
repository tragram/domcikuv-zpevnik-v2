from utils import extract_metadata, get_lyrics, normalize_string, songs_path

chordpro_dir = songs_path() / "chordpro"
total_max = 0
for file_path in chordpro_dir.glob("*.pro"):
    lyrics = get_lyrics(file_path)
    song_max = max(len(line) for line in (lyrics.split("\n")))
    if song_max >= 60:
        print(f"Maximum line length in {file_path} is {song_max}")
    total_max = max(total_max, song_max)
print(f"Maximum line length is {total_max}")
