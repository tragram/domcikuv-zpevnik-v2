import os
import random
import re
import time
from pathlib import Path

from googlesearch import search
from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from utils import check_if_lyrics_present, extract_metadata, get_lyrics, songs_path
from webdriver_manager.chrome import ChromeDriverManager

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))


def process_chordpro_file(filepath):
    """
    Processes a single ChordPro file: checks for lyrics and extracts title and artist.
    """
    # Check if the file contains any lyrics
    if not check_if_lyrics_present(filepath):
        # Extract title and artist from the directives
        artist, title, key = extract_metadata(filepath)
        if title and artist:
            print(f"File: {filepath}")
            print(f"Title: {title}")
            print(f"Artist: {artist}")
            return artist, title, key
        else:
            print(f"File: {filepath} - Missing artist or title directive.")
    else:
        print(f"File: {filepath} contains lyrics.")


def scrape_akordy_pisnicky(url, key="D"):
    # Set up the Chrome WebDriver using the webdriver manager

    # Navigate to the page
    driver.get(url)

    # transpose
    transpose_element = driver.find_element(By.ID, "trans")
    key_button = transpose_element.find_element(By.LINK_TEXT, key)
    key_button.click()
    time.sleep(2)

    # Find the element containing the song (by its id 'songtext')
    song_element = driver.find_element(By.ID, "songtext")
    # Extract the full text content as rendered (with spacing)
    rendered_text = song_element.text

    return rendered_text


def process_chordpro_folder(
    songs_path: Path, chordpro_folder="chordpro", scrape_folder="scraped"
):
    """
    Walks through a folder and processes all ChordPro (.pro or .cho) files.

    """
    os.makedirs(songs_path / scrape_folder, exist_ok=True)
    chordpro_files = list((songs_path / chordpro_folder).glob("*.pro"))
    # Random shuffle to avoid wasting available searches before error 429 on the start of the list.
    random.shuffle(chordpro_files)
    for filepath in chordpro_files:
        print("-" * 40)
        scraped_path = Path(songs_path / scrape_folder / f"{filepath.stem}.txt")
        lyrics = get_lyrics(filepath)
        if scraped_path.exists():
            if len(lyrics) > 50:
                print("Deleting", scraped_path)
                scraped_path.unlink()
            print(scraped_path, "exists --> skipping")
            continue
        if len(lyrics) > 50:
            continue
        r = process_chordpro_file(filepath)
        if r is not None:
            artist, title, key = r
        else:
            continue
        google_urls = search(f"{artist} {title} site:pisnicky-akordy.cz")
        pisnicky_akordy_url = list(google_urls)
        if len(pisnicky_akordy_url) == 0:
            print(
                "Didn't find anything for ", f"{artist} {title} site:pisnicky-akordy.cz"
            )
            song_text = ""
        else:
            pisnicky_akordy_url = pisnicky_akordy_url[0]
            try:
                song_text = scrape_akordy_pisnicky(pisnicky_akordy_url, key.title())
            except NoSuchElementException:
                print(
                    "Didn't find chords for",
                    pisnicky_akordy_url,
                    "saving an empty file",
                )
                song_text = ""
            except Exception as e:
                print(pisnicky_akordy_url, e)
                raise e
            # For now, just print the extracted song text to ensure it's correct
            print(f"Extracted song from {pisnicky_akordy_url}:\n{song_text}\n")

        # Optionally save the extracted song text to a file
        with open(scraped_path, "w", encoding="utf8") as file:
            file.write(song_text)
            print(f"Saved: {artist} - {title}.txt")


process_chordpro_folder(songs_path())
