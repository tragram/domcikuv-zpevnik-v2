import re
from pathlib import Path

import yaml
from huggingface_hub import InferenceClient, login
from openai import OpenAI
from PIL import Image
from utils import get_lyrics, songs_path

with open(Path(__file__).parent.parent / "secrets.yaml", "r") as f:
    secrets = yaml.safe_load(f)
login(token=secrets["hugging_face_token"])


def summarize_lyrics(lyrics, model="gpt-4o-mini"):
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
                "content": "Based on the following song lyrics, create a prompt for an AI image generator that will be used as an illustration of the song. Try to be short.",
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


def save_response(response, stem):
    with open(f"songs/image_prompts/{stem}.yaml", "w") as f:
        yaml.safe_dump(
            {"model": response.model, "response": response.choices[0].message.content},
            f,
        )
    print(f"Saving prompt for {stem} by {response.model}.")


def retrieve_model_prompt(prompt_path: Path, model: str = "gpt-4o-mini") -> str | None:
    if not prompt_path.exists():
        return None
    with open(prompt_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if isinstance(data, dict):
        data = [data]
        with open(prompt_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(data, f)
    for d in data:
        if model in d["model"]:
            return d["response"]
    return None


def generate_missing_prompts(model="gpt-4o-mini"):
    songs = Path(songs_path() / "chordpro/").glob("*.pro")
    for song in songs:
        existing_prompt = retrieve_model_prompt(
            songs_path() / "image_prompts" / (song.stem + ".yaml"), model
        )
        if existing_prompt is not None:
            print(song.stem, "already generated --> skipping")
            continue
        lyrics = get_lyrics(song)
        if len(lyrics) < 100:
            print(song.stem, "- lyrics too short --> skipping")
            continue
        response = summarize_lyrics(lyrics, model)
        save_response(response, song.stem)
        # break


def generate_missing_images(
    prompt_model="gpt-4o-mini", model="black-forest-labs/FLUX.1-dev"
):
    def model2filename(model):
        return model.split("/")[-1] + ".webp"

    client = InferenceClient(
        token=secrets["hugging_face_token"],
    )
    for song_prompt in Path(songs_path() / "image_prompts").glob("*.yaml"):
        image_folder = Path(songs_path() / f"illustrations/{song_prompt.stem}")
        thumbnails_folder = Path(
            songs_path() / f"illustrations_thumbnails/{song_prompt.stem}"
        )
        image_folder.mkdir(parents=True, exist_ok=True)
        thumbnails_folder.mkdir(parents=True, exist_ok=True)
        image_filename = image_folder / model2filename(model)
        if image_filename.is_file():
            print(f"{song_prompt.stem} already generated with {model} --> skipping")
        else:
            prompt = retrieve_model_prompt(song_prompt, prompt_model)
            img = client.text_to_image(
                prompt=prompt,
                height=512,
                width=512,
                model=model,
            )
            img.save(image_folder / model2filename(model))
            print(f"Saving illustration for {song_prompt.stem} generated by {model}")
        if not (thumbnails_folder / f"{model2filename(model)}").is_file:
            img = Image.open(image_filename)
            img.thumbnail((128, 128))
            img.save(thumbnails_folder / f"{model2filename(model)}")


generate_missing_prompts()
generate_missing_images()
