import numpy as np
from utils import get_lyrics, songs_path

chordpro_dir = songs_path() / "chordpro"
total_max = 0
for file_path in chordpro_dir.glob("*.pro"):
    lyrics = get_lyrics(file_path)
    line_lengths = [len(line) for line in (lyrics.split("\n")) if len(line) > 0]

    if len(line_lengths) == 0:
        print(f"Detected empty song: {file_path.stem}")
        continue
    line_max = max(line_lengths)
    if line_max >= 60:
        print(f"Maximum line length in {file_path.stem} is {line_max}")
    total_max = max(total_max, line_max)
    # line_min = min([l for l in line_lengths if l > 10])
    line_min = min([l for l in line_lengths if l > 0])
    if line_max / line_min >= 5:
        print(f"Max to min line length in {file_path.stem} is {line_max/line_min}")
    pecrentile_high = 60
    line_percentile_high = np.percentile(line_lengths, pecrentile_high)
    if line_max / line_percentile_high > 2:
        print(
            f"Max to {pecrentile_high}th percentile line length ratio in {file_path.stem} is {line_max/line_percentile_high}"
        )
    percentile_low = 30
    line_percentile_low = np.percentile(line_lengths, percentile_low)
    if line_max / line_percentile_low > 3:
        print(
            f"Max to {percentile_low}th percentile line length ratio in {file_path.stem} is {line_max/line_percentile_low}"
        )
print(f"Maximum line length is {total_max}")
