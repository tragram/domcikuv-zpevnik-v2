import os
import random
import re
import time
from pathlib import Path

from googlesearch import search
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager


def check_if_lyrics_present(content):
    """
    Checks if there are any lyrics (non-directive, non-chord) in the content.
    """
    # Split the content into lines
    lines = content.splitlines()
    
    for line in lines:
        # Skip lines that are purely directives (e.g., {title: ...}, {artist: ...}, etc.)
        if re.match(r"^\{.*\}$", line.strip()):
            continue
        
        # If there's anything that isn't a directive and isn't empty, assume it's lyrics
        if line.strip():  # Any non-empty line that isn't a directive
            return True
    
    return False

def get_directive(content, directive_name):
    """
    Extracts a specific directive (e.g., title, artist) from the ChordPro content.
    """
    pattern = re.compile(r"\{" + directive_name + r":\s*(.*?)\}")
    match = pattern.search(content)
    if match:
        return match.group(1).strip()
    return None

def process_chordpro_file(filepath):
    """
    Processes a single ChordPro file: checks for lyrics and extracts title and artist.
    """
    with open(filepath, "r", encoding="utf-8") as file:
        content = file.read()
    
    # Check if the file contains any lyrics
    if not check_if_lyrics_present(content):
        # Extract title and artist from the directives
        title = get_directive(content, "title")
        artist = get_directive(content, "artist")
        key = get_directive(content, "key")
        if title and artist:
            print(f"File: {filepath}")
            print(f"Title: {title}")
            print(f"Artist: {artist}")
            return artist,title,key
        else:
            print(f"File: {filepath} - Missing artist or title directive.")
    else:
        print(f"File: {filepath} contains lyrics.")


def scrape_akordy_pisnicky(url, key="D"):
    # Set up the Chrome WebDriver using the webdriver manager
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))

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

    # Close the browser
    driver.quit()

    return rendered_text
def process_chordpro_folder(folder_path):
    """
    Walks through a folder and processes all ChordPro (.pro or .cho) files.

    """
    chordpro_files=list(Path(folder_path).glob("*.pro"))
    # Random shuffle to avoid wasting available searches before error 429 on the start of the list.
    random.shuffle(chordpro_files)
    for filepath in chordpro_files:
        print("-" * 40)
        if Path(f"songs/scraped/{filepath.stem}.txt").exists():
            print(f"songs/scraped/{filepath.stem}.txt exists --> skipping")
            continue
        r=process_chordpro_file(filepath)
        if r is not None:
            artist,title,key=r
        else:
            continue
        google_urls=search(f"{artist} {title} site:pisnicky-akordy.cz")
        pisnicky_akordy_url=list(google_urls)
        if len(pisnicky_akordy_url)==0:
            print("Didn't find anything for ",f"{artist} {title} site:pisnicky-akordy.cz")
            continue
        else:
            pisnicky_akordy_url=pisnicky_akordy_url[0]
        # Process each URL and print the extracted text
        try:
            song_text = scrape_akordy_pisnicky(pisnicky_akordy_url,key.title())
        except Exception as e:
            print(pisnicky_akordy_url,e)
            continue
        # For now, just print the extracted song text to ensure it's correct
        print(f"Extracted song from {pisnicky_akordy_url}:\n{song_text}\n")

        # Optionally save the extracted song text to a file
        os.makedirs("songs/scraped",exist_ok=True)
        with open(f"songs/scraped/{filepath.stem}.txt", 'w', encoding="utf8") as file:
            file.write(song_text)
            print(f"Saved: {artist} - {title}.txt")

folder_path = "songs/chordpro"
process_chordpro_folder(folder_path)