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
from webdriver_manager.chrome import ChromeDriverManager


def songDB_path():
    return Path(__file__).parent.parent / "public/songDB.json"


driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
with open(songDB_path(), encoding="utf-8") as f:
    songDB = json.load(f)
# sort songDB by date added for new additions
songDB.sort(key=lambda song: song["date_added"], reverse=True)


def click_dropdown(driver, fit):
    try:
        font_size_settings_button = driver.find_element(By.ID, f"font_size_settings")
    except NoSuchElementException:
        return False
    try:
        font_size_settings_button.click()
    except ElementNotInteractableException:
        pass
    try:
        fit_screen_button = driver.find_element(By.ID, f"{fit}Dropdown")
    except NoSuchElementException:
        return False
    fit_screen_button.click()
    return True


def song_id(song):
    return unidecode.unidecode(
        f"{song["artist"]}-{song["title"]}".replace(" ", "_").replace("?", "")
    )


results = []
for song in songDB:
    try:
        url = "http://localhost:5173/domcikuv-zpevnik-v2/#/song/" + song_id(song)
        driver.get(url)
        song_results = {"song.id": song_id(song)}
        resolutions = {
            "Galaxy Tab S7": (1600 / 2, 2560 / 2),
            "iPhone XR": (828 / 2, 1792 / 2),
            "Galaxy Z Flip6": (1080 / 2, 2640 / 2),
        }
        for device, window_size in resolutions.items():
            for fit in ["fitX", "fitXY"]:
                driver.set_window_size(*window_size)
                driver.refresh()
                timeout = time.time() + 5
                while time.time() < timeout:
                    # wait for it to load
                    try:
                        song_content = driver.find_element(By.ID, "song_content")
                        break
                    except:
                        continue
                if not click_dropdown(driver, fit):
                    fit_screen_button = driver.find_element(By.ID, f"{fit}Button")
                    fit_screen_button.click()

                time.sleep(1)
                font_size = song_content.value_of_css_property("font-size")
                song_results[f"{device}_{fit}_font-size"] = font_size

        results.append(song_results)
        print(song_results)
    except Exception as e:
        print(song_id(song), e)

results = pd.DataFrame(results)
print(results)
results.to_csv("scripts/font-sizes.csv")
