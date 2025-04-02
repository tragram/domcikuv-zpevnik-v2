import re
import time
from pathlib import Path

import yaml
from huggingface_hub import InferenceClient
from huggingface_hub import errors as hugging_errors
from huggingface_hub import login
from openai import OpenAI
from PIL import Image
from utils import get_lyrics, load_secrets, songs_path

PROMPTS = {
    "v1":"Based on the following song lyrics, create a prompt for an AI image generator that will be used as an illustration of the song. Try to be short",
    "v2":"Based on the following song lyrics, create a prompt for an AI image generator that will be used as an illustration of the song. Try to be short but also to capture a concrete scene/idea from the song."
}
SELECTED_PROMPT = "v2"

SELECTED_PROMPT_MODEL="gpt-4o-mini"

model_stable_diff = "stabilityai/stable-diffusion-3.5-large"
model_flux_dev = "black-forest-labs/FLUX.1-dev"
SELECTED_IMAGE_MODEL = model_flux_dev

secrets = load_secrets()
login(token=secrets["hugging_face_token"])

def summarize_lyrics(lyrics, model,prompt_id):
    client = OpenAI(
        api_key=secrets["openai"]["api_key"],
        organization=secrets["openai"]["organization_id"],
        project=secrets["openai"]["project_id"],
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": PROMPTS[prompt_id]
            },
            {
                "role": "user",
                "content": lyrics,
            },
        ],
        temperature=0.7,
        top_p=0.8,
    )
    return response

def prompt_path(stem):
    return songs_path() / "image_prompts" / (stem + ".yaml")

def save_response(model, prompt_id, response, stem):
    filepath = prompt_path(stem)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or []
    except FileNotFoundError:
        data = []
    
    if not isinstance(data, list):
        data = [data]  # Convert to list if it's not already
    
    new_entry = {
        "model": model,
        "prompt_id": prompt_id,
        "response": response.choices[0].message.content,
    }
    
    data.append(new_entry)
    
    with open(filepath, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, allow_unicode=True, default_flow_style=False)
    
    print(f"Saving prompt for {stem} by {response.model}.")


def retrieve_model_prompt(prompt_path: Path, model: str,prompt_id:str) -> str | None:
    if not prompt_path.exists():
        return None
    with open(prompt_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    for d in data:
        if model in d["model"] and d["prompt_id"]==prompt_id:
            return d["response"]
    return None


def generate_missing_prompts(model, prompt_id):
    songs = Path(songs_path() / "chordpro/").glob("*.pro")
    for i,song in enumerate(songs):
        existing_prompt = retrieve_model_prompt(
            prompt_path(song.stem),model,prompt_id
        )
        if existing_prompt is not None:
            print(song.stem, "already generated --> skipping")
            continue
        lyrics = get_lyrics(song)
        if len(lyrics) < 100:
            print(song.stem, "- lyrics too short --> skipping")
            continue
        response = summarize_lyrics(lyrics, model,prompt_id)
        save_response(model, prompt_id, response, song.stem)

def generate_missing_images(
    prompt_model, prompt_id, model="black-forest-labs/FLUX.1-dev"
):
    def model2filename(prompt_model,prompt_id,model):
        return f"{prompt_model}_{prompt_id}_{model.split("/")[-1]}.webp"

    client = InferenceClient(
        token=secrets["hugging_face_token"],
    )
    generation_times = []
    for song_prompt in Path(songs_path() / "image_prompts").glob("*.yaml"):
        # hugging face API only allows 3 requests per minute
        current_time = time.time()
        if len(generation_times) >= 3 and current_time - generation_times[-3] < 60:
            sleep_time = 60 - (current_time - generation_times[-3]) + 5
            print(f"Sleeping for {sleep_time:.1f}")
            time.sleep(sleep_time)

        # now finally get to the generation
        image_folder = Path(songs_path() / f"illustrations/{song_prompt.stem}")
        thumbnails_folder = Path(
            songs_path() / f"illustrations_thumbnails/{song_prompt.stem}"
        )
        image_folder.mkdir(parents=True, exist_ok=True)
        thumbnails_folder.mkdir(parents=True, exist_ok=True)
        image_filename = image_folder / model2filename(prompt_model,prompt_id,model)
        if image_filename.is_file():
            print(f"{song_prompt.stem} already generated with {model} --> skipping")
        else:
            prompt = retrieve_model_prompt(song_prompt, prompt_model, prompt_id)
            try:
                img = client.text_to_image(
                    prompt=prompt,
                    height=512,
                    width=512,
                    model=model,
                )
            except hugging_errors.HfHubHTTPError as e:
                print(e)
                time.sleep(5)
                continue
            img.save(image_filename)
            generation_times.append(current_time)
            print(f"Saving illustration for {song_prompt.stem} generated by {model}")
        for image_filename in [f.name for f in image_folder.glob("*.webp")]:
            if not (thumbnails_folder / image_filename).is_file():
                img = Image.open(image_folder / image_filename)
                img.thumbnail((128, 128))
                img.save(thumbnails_folder / image_filename)


# generate_missing_prompts(model=SELECTED_PROMPT_MODEL,prompt_id=SELECTED_PROMPT)
generate_missing_images(prompt_model=SELECTED_PROMPT_MODEL,prompt_id=SELECTED_PROMPT,model=SELECTED_IMAGE_MODEL)
