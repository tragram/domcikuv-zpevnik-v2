import json
import time
from pathlib import Path

import pandas as pd
import unidecode
from selenium import webdriver
from selenium.common.exceptions import (
    ElementNotInteractableException,
    NoSuchElementException,
)
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from utils import filename_stem
from webdriver_manager.chrome import ChromeDriverManager


def songDB_path():
    return Path(__file__).parent.parent / "public/songDB.json"


def find_preset_button(driver, preset):
    # Locate the visible preset selector
    preset_selectors = [
        "preset-selector-large",
        "preset-selector-small",
    ]

    for selector_id in preset_selectors:
        try:
            preset_selector = driver.find_element(By.ID, selector_id)
            if preset_selector.is_displayed():
                break

        except NoSuchElementException as e:
            print(e)
            continue

    radio_buttons = preset_selector.find_elements(By.XPATH, ".//*[@role='radio']")
    if preset == "Compact":
        return radio_buttons[0]
    elif preset == "Scroll":
        return radio_buttons[-1]
    else:
        raise NoSuchElementException("Could not find the preset button!")


def sync_columns(driver, required_cols):
    def current_cols():
        try:
            driver.find_element(By.CLASS_NAME, "song-content-columns")
            return 2
        except NoSuchElementException:
            return 1

    columns_button = driver.find_element(By.ID, "two-cols-button")
    while current_cols() != required_cols:
        driver.execute_script("arguments[0].click();", columns_button)
        time.sleep(1)


driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
with open(songDB_path(), encoding="utf-8") as f:
    songDB = json.load(f)
# sort songDB by date added for new additions
songDB.sort(key=lambda song: song["date_added"], reverse=True)

results = []
for song in songDB:
    try:
        song_id = filename_stem(song["artist"], song["title"])
        url = "http://localhost:5173/domcikuv-zpevnik-v2/#/song/" + song_id
        driver.get(url)
        song_results = {"song.id": song_id}
        resolutions = {
            "Galaxy Tab S7": (1600 / 2, 2560 / 2),
            "iPhone XR": (828 / 2, 1792 / 2),
            "Galaxy Z Flip6": (1080 / 2, 2640 / 2),
        }
        for device, window_size in resolutions.items():
            print(device)
            cols = [1] if device != "Galaxy Tab S7" else [1, 2]
            driver.set_window_size(*window_size)
            driver.refresh()
            time.sleep(2)  # wait for page load
            for col in cols:
                sync_columns(driver, col)
                for preset in ["Compact", "Scroll"]:
                    song_content = driver.find_element(By.ID, "song-content-wrapper")
                    preset_button = find_preset_button(driver, preset)
                    preset_button.click()
                    time.sleep(1)
                    font_size = song_content.value_of_css_property("font-size")
                    song_results[
                        f"{device}_{preset}_{str(col)+'cols_' if col!=1 else ''}font-size_px"
                    ] = font_size.replace("px", "")
                    print(font_size)

                    timeout = time.time() + 2

        results.append(song_results)
        print(song_results)
    except Exception as e:
        print(song_id, e)
        break

results = pd.DataFrame(results)
print(results)
results.to_csv("font-sizes.csv")
