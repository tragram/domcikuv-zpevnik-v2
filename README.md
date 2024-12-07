# Domčíkův Zpěvník v2
Welcome to the source code of my songbook, [available on Github Pages](https://tragram.github.io/domcikuv-zpevnik-v2/). It shows most of the songs I will play for you (without complaining :-)) and provides features like searching, filtering and sorting, as well as random song generation, transpositions etc.

### Previous version
The original songbook was my high-school graduation project, consisting of an [Android app](https://github.com/tragram/DomcikuvZpevnik) and a [PHP server](https://github.com/tragram/DomcikuvZpevnik-Server) is [hosted here](https://appelt.cz/domcikuvzpevnik/). Unfortunately, due to lack of updates, the app was taken down from Google Play in 2024 and the website was not mobile-friendly, which is the main use-case of the songbook. Since I no longer code in Java or PHP, I started building this new version to have something to do on the long train journey to the Tatra mountains!

## Editing songs
Songs are written in an extended [ChordPro](https://www.chordpro.org/chordpro/chordpro-introduction/) format, stored in the songs/ directory. Pushes to the main branch trigger automatic updates (live in a few minutes). If you don't have edit rights, submit a pull request or let me know. 😉

For local editing, you will need to manually run `npm run prebuild` to recreate the database with your changes.

### File format
The songs shall be named `artist_name-song_name.pro` (any special characters converted to ASCII). Use `scripts/format_songs.py` to rename files (and fix common whitespace issues) automatically.

A song should have the following preamble (tempo may be left empty - it's currently not used):
```chordpro
{artist: František Vomáčka}
{title: Svíčková}
{language: english}
{date_added: 02-2020}
{capo: 0}
{key: H}
{range: c1-f#2}
{tempo: 110}
```
**Note that the chords need to use the Czech/German note names (H:=B, B:=Bb).**

To exclude a file from the database, simply insert `{disabled: true}` in the preamble.

#### Song range
The behavior of the range is parameter can feel a bit strange. The numbers don't mean the traditional octaves as you might expect but are rather relative to the lower note (which is always a '1'). For example, transposing "c1-d2" (14 semitones) down by one semitone yields "h1-c#2". I know this is confusing but it's been like this in my songbook for many years and did not feel like changing this part too. Maybe in the future. :-)

You can also include an additional voice with a backslash, such as "c1/e1-d2/c3". Currently, the range is determined by the first voice. The regex against which it will be matched is `([A-Ha-h][#b]{0,2})([1-9])(?:/([A-Ha-h][#b]{0,2})([1-9]))?-([A-Ha-h][#b]{0,2})([1-9])(?:/([A-Ha-h][#b]{0,2})([1-9]))?`. [Here's the railroad diagram](https://regexper.com/#%28%5BA-Ha-h%5D%5B%23b%5D%7B0%2C2%7D%291%28%3F%3A%5C%2F%28%5BA-Ha-h%5D%5B%23b%5D%7B0%2C2%7D%29%28%5B1-9%5D%29%29%3F-%28%5BA-Ha-h%5D%5B%23b%5D%7B0%2C2%7D%29%28%5B1-9%5D%29%28%3F%3A%5C%2F%28%5BA-Ha-h%5D%5B%23b%5D%7B0%2C2%7D%29%28%5B1-9%5D%29%29%3F) if you're interested. :-)

### Extensions of the ChordPro format
Despite the ChordPro format being the only widely used, the specification lacks many nice-to-have features and even when they do exist, JS parsers do not implement them. For convenience, I have added the following:

#### Recall
You have the possibility to keep in memory more than one chorus/verse/bridge. You can define the label of the chorus (note: it will be displayed!) in the directive by e.g. 
```chordpro
{start_of_chorus: R1}
content1
{end_of_chorus}
{start_of_chorus: R2}
content2
{end_of_chorus}
```
and them later recall them by 
```
{chorus: R1}
{chorus: R2}
{chorus: R1}
```
The labels may contains letters, numbers, and the following special characters: `+_-/`. In short, they must match `[\w\-_+]+`.

#### Part variants
It is very common that a chorus is repeated with only a minor modification at the end. To avoid these repetitions, you can define a variant of the chorus as follows:
```
{start_of_variant: replace_last_line}
This is the end.
{end_of_variant}
{chorus}
```
This will replace the last line of the following recall directive (`{chorus}` in this case) if expanded and add a note that the last line is different if collapsed. Make sure to repeat the chords again.

Generalization to more lines being replaced is planned but not implemented yet.

Another common occurrence is that the final chorus has an additional line. This can be defined analogously by using  `{start_of_variant: append_content}`.

Lastly, though less common, it might happen that a part has a variation at the start. For that, you have `{start_of_variant: replace_first_line}` and `{start_of_variant: prepend_content}`. These work analogously to their "end" counterparts.

Applying multiple variants at the same time is not possible - just write it again. ;)

### Image generation
Since it's 2024, I decided to use AI for tasks other than helping me code this thing. The `scripts/generate_images.py` script loads the lyrics of each of the songs and generates a prompt (in English) for an image generation model.

Because the songs have lyrics in many languages, it is currently (October 2024) necessary to use GPT-4o to generate the prompt based on the lyrics, as it has by far the best multilingual capabilities for tiny languages like Czech, Slovak, Finnish or Estonian. By default, the script uses GPT-4o-mini which still provides very satisfactory results (you can see for yourself in `songs/image_prompts`) at a fraction of the cost (around 0.01USD/50 songs).

Generating the prompt in English allows us to use any "old image" generation network. Because DALL-E 3 is pretty expensive (0.040-0.080$/image) and can only generate images that are 1024×1024 (which is too large/detailed for the thumbnails), I decided to just use the free [Hugging Face](https://huggingface.co/) API. In particular, I landed on the [FLUX.1-dev](https://huggingface.co/black-forest-labs/FLUX.1-dev) model for most of the illustrations. It is still possible to override the image shown by adding e.g. `{illustration_author: dalle3}` in the preamble and including `songs/illustrations/artist_name-song_name/dalle3.webp`. To generate the thumbnail, run `scripts/generate_images.py`.

To generate prompts and images, you need to provide your own `secrets.yaml` file with your API keys in the following format:
```yaml
hugging_face_token: YOUR_TOKEN
openai:
  api_key: YOUR_TOKEN
  organization_id: YOUR_ORG_ID
  project_id: YOUR_PROJECT_ID
```

For fun, I asked ChatGPT to generate a logo for this project. Well, let's just say that while letters in English have improved a lot, it still has issues with foreign characters.

<img src="public/dalle_logo.webp" title="Logo generated by DALL-E 3" width="300">

### Web scraping for lyrics & chords
When moving from the old PDF-based songbook, there was a need to recreate almost 300 songs in ChordPro. Naturally, some automation had to be done in order not to spend the rest of my life on this step.

If you define a `.pro` file with just the preamble and no body, you can try running `scripts/scrape_songs.py`. It will use [Selenium](https://pypi.org/project/selenium/) perform a Google search on [Písničky Akordy](https://pisnicky-akordy.cz/), transpose it to the key specified in the preamble and download the contents into `songs/scraped/artist_name`. 

Songs from there *usually* are in their "standard" format but it's worth checking because it's easier to fix it at this step that:
* verses/chords are clearly separated by an empty line
* verses start by e.g. "1. " (the space is necessary!)
* chorus starts by "R: "
* bridge starts by "B: "
* chords are aligned  above the lyrics
If this holds, you can run `scripts/chordpro_from_txt.py` and it will process the contents, inserting chords where appropriate (avoiding inserting the chords at the very start of the word in case of minor misalignments) and converting the verse numbers etc. into ChordPro directives.

### Checking song aspect ratio
Because most viewing is done using the `fitXY` feature, it is important to keep in balance the maximum line length and number of lines in the song to ensure proper fit. And wouldn't you know it - there's a Python script even for that! Run `find_font_sizes.py` to automatically evaluate the resulting font-size of each of the songs at a few selected screen sizes (at the time of writing: `Galaxy Tab S7, iPhone XR, Galaxy Z Flip6`).

This is done via Selenium again, so expect it to take a while. Also, do not expect it to work at all in fact, since it's prone to breaking with any future changes! :-)

## Tech
Website built on React+Vite, styled by [TailwindCSS](https://tailwindcss.com) and (heavily modified) [shadcn](https://ui.shadcn.com/) and uses the following libraries:
* [Lucide](https://lucide.dev/): icons
* [chordpro-parser](https://github.com/chordproject/chorpro-parser/): parsing Chordpro in JS
* [Fuse.js](https://www.fusejs.io/): fuzzy search
* [auto-text-size](https://www.npmjs.com/package/auto-text-size): automatic sizing of chords & lyrics
* [country-flag-icons](https://www.npmjs.com/package/country-flag-icons)

## TODO:
A lot ATM. The major feature to add is:
* Make the website a [PWA](https://en.wikipedia.org/wiki/Progressive_web_app) to make it available 100 % offline.
