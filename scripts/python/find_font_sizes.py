"""Sample current SongView layouts against a running, seeded local app."""
import argparse
import time
from pathlib import Path
from urllib.parse import quote

import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from utils import songs_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:5173")
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("font-sizes.csv"))
    args = parser.parse_args()
    songs = sorted((songs_path() / "chordpro").glob("*.pro"))
    if not songs:
        raise RuntimeError("No songs/chordpro files found")
    driver = webdriver.Chrome()
    results = []
    try:
        for song in songs:
            result = {"song.id": song.stem}
            driver.get(f"{args.base_url.rstrip('/')}/song/{quote(song.stem)}")
            for device, size in {"Galaxy Tab S7": (800, 1280), "iPhone XR": (414, 896), "Galaxy Z Flip6": (540, 1320)}.items():
                driver.set_window_size(*size)
                for columns in ([1, 2] if device == "Galaxy Tab S7" else [1]):
                    for preset, mode in [("Compact", "fitXY"), ("Scroll", "fitX")]:
                        # Former radio roles and two-cols-button no longer exist.
                        driver.execute_script("""
                            const key = 'songview-settings-store';
                            const stored = JSON.parse(localStorage.getItem(key) || '{}');
                            stored.state ??= {};
                            stored.state.layout = {...stored.state.layout,
                                fitScreenMode: arguments[0], multiColumns: arguments[1],
                                smartColumns: false, compactInFullScreen: false};
                            localStorage.setItem(key, JSON.stringify(stored));
                        """, mode, columns == 2)
                        driver.refresh()
                        content = WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, "song-content-wrapper")))
                        driver.execute_async_script("document.fonts.ready.then(arguments[0]);")
                        time.sleep(1)
                        name = f"{device}_{preset}_{str(columns)+'cols_' if columns != 1 else ''}font-size_px"
                        result[name] = content.value_of_css_property("font-size").removesuffix("px")
            results.append(result)
            pd.DataFrame(results).to_csv(args.output, index=False)
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
