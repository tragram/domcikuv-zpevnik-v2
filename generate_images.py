import re
from pathlib import Path

import yaml
from huggingface_hub import InferenceClient, login
from openai import OpenAI

with open("secrets.yaml", "r") as f:
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


def load_chordpro_file(filepath):
    # Read the file content
    with open(filepath, "r", encoding="utf8") as file:
        content = file.read()
    return content


def remove_chordpro_directives(content):
    # Remove ChordPro directives (anything inside curly or square brackets brackets)
    content = re.sub(r"\{.*?\}", "", content)
    content = re.sub(r"\[.*?\]", "", content)
    content = re.sub(r"[ ]+", " ", content)
    content = re.sub(r"\n{3,}", "\n\n", content)
    return content.strip()


def generate_missing_prompts(model="gpt-4o-mini"):
    songs = Path("songs/").glob("*.pro")
    generated_prompts = [p.stem for p in Path("songs/image_prompts").glob("*.yaml")]

    for song in songs:
        if (song.stem) in generated_prompts:
            print(song.stem, "already generated --> skipping")
            continue
        song_str = load_chordpro_file(song)
        lyrics = remove_chordpro_directives(song_str)
        response = summarize_lyrics(lyrics)
        save_response(response, song.stem)
        # break


def generate_missing_images(model="black-forest-labs/FLUX.1-dev"):
    def model2filename(model):
        return model.split("/")[-1] + ".jpg"

    def load_prompt(song_prompt):
        with open(song_prompt, "r") as f:
            data = yaml.safe_load(f)
        return data["response"]

    client = InferenceClient(
        token=secrets["hugging_face_token"],
    )
    for song_prompt in Path("songs/image_prompts").glob("*.yaml"):
        image_folder = Path(f"songs/images/{song_prompt.stem}")
        image_folder.mkdir(parents=True, exist_ok=True)
        image_filename = image_folder / model2filename(model)
        if image_filename.is_file():
            print(f"{song_prompt.stem} already generated with {model} --> skipping")
            continue
        prompt = load_prompt(song_prompt)
        img = client.text_to_image(
            prompt=prompt,
            height=512,
            width=512,
            model=model,
        )
        print(f"Saving illustration for {song_prompt.stem} generated by {model}")
        img.save(image_filename)
        # break


generate_missing_prompts()
generate_missing_images()
