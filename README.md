# Domčíkův Zpěvník v2
Welcome to the source code of my songbook, [hosted here](https://hodan.page/zpevnik). It shows most of the songs I will play for you (without complaining :-)) and provides features like searching, filtering and sorting, as well as random song generation, transpositions etc.

### PWA
The app is a progressive web application (PWA), which means you can install it on your device and use it completely offline. This feature is best supported by Chrome, unless you're using iOS, in which case Safari is likely your best bet. Other browser/OS configurations may work (especially in the future) but are not recommended.

### Previous version
The original songbook was my high-school graduation project, consisting of an [Android app](https://github.com/tragram/DomcikuvZpevnik) and a [PHP server](https://github.com/tragram/DomcikuvZpevnik-Server) is [hosted here](https://appelt.cz/domcikuvzpevnik/). Unfortunately, due to lack of updates, the app was taken down from Google Play in 2024 and the website was not mobile-friendly, which is the main use-case of the songbook. Since I no longer code in Java or PHP, I started building this new version to have something to do on the long train journey to the Tatra mountains!

## Running locally
You can run the page fully locally by
* installing the dependencies: `pnpm i`
* creating a CF Worker account (TODO: allow local build without this step)
* building the database: `pnpm db:create` (if you haven't run it yet)
* generating the migrations: `pnpm db:generate`
* migrating the DB: `pnpm db:migrate:local`
* starting the server: `pnpm dev`

## Editing songs
Songs are written in an extended [ChordPro](https://www.chordpro.org/chordpro/chordpro-introduction/) format, stored in the `songs/` directory. Pushes to the main branch trigger automatic updates (live in a few minutes). If you don't have edit rights, submit a pull request or let me know. 😉

### File format
The songs shall be named `artist_name-song_name.pro` (any special characters converted to ASCII). Use `scripts/format_songs.py` to rename files (and fix common whitespace issues) automatically. It also converts repetition symbols (`|:` and `:|` to `𝄆` and `𝄇`) which are then highlighted in the HTML.

A song shall have the following preamble (tempo may be left empty - it's currently not used):
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

#### Songbooks
Users can filter by songbook. Each song has a list of songbooks in which it is included. Care must be taken to type the name properly, there's no autocorrect. ;-) Also, make sure to use double quotes.

All songbook names will be collected and used for filters. To define an avatar of the songbook (that will be shown in the filter and in the list on wide screens), define the URL in `src\components\songbookAvatars.tsx`. I know, not a very elegant solution, but it works for now since probably not that many people will be adding songs. Alternatively, the system will try to locate the file `/public/avatars/[songbook].png`. The fallback will be the first letter of the songbook, so not all is lost if you don't have your avatar.

#### Song range
The behavior of the range parameter can feel a bit strange. The numbers don't mean the traditional octaves as you might expect but are rather relative to the lower note (which is typically a '1'). For example, transposing "c1-d2" (14 semitones) down by one semitone yields "h1-c#2". I know this is confusing but it's been like this in my songbook for many years and did not feel like changing this part too. Maybe in the future. :-)

You can also include an additional voice with a backslash, such as "c1/e1-d2/c3". Currently, the range is determined by the first voice. The regex against which it will be matched is `([A-Ha-h][#b]{0,2})([1-9])(?:/([A-Ha-h][#b]{0,2})([1-9]))?-([A-Ha-h][#b]{0,2})([1-9])(?:/([A-Ha-h][#b]{0,2})([1-9]))?`. [Here's the railroad diagram](https://regexper.com/#%28%5BA-Ha-h%5D%5B%23b%5D%7B0%2C2%7D%29%28%5B1-9%5D%29%28%3F%3A%5C%2F%28%5BA-Ha-h%5D%5B%23b%5D%7B0%2C2%7D%29%28%5B1-9%5D%29%29%3F-%28%5BA-Ha-h%5D%5B%23b%5D%7B0%2C2%7D%29%28%5B1-9%5D%29%28%3F%3A%5C%2F%28%5BA-Ha-h%5D%5B%23b%5D%7B0%2C2%7D%29%28%5B1-9%5D%29%29%3F) if you're interested. :-)

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
The labels may contain letters, numbers, spaces and the following special characters: `+_-/.`. In short, they must match `[\w\-_+ .\p{L}]+`.

#### Part variants
It is very common that a chorus is repeated with only a minor modification at the end. To avoid these repetitions, you can define a variant of the chorus as follows:
```
{start_of_variant: replace_last_line}
This is the end.
{end_of_variant}
{chorus}
```
This will replace the last line of the recall directive that follows (`{chorus}` in this case). If the part is collapsed, it will add a note that the last line is different. Make sure to repeat the chords again.

Generalization to more lines being replaced is planned but not implemented yet.

Another common occurrence is that the final chorus has an additional line. This can be defined analogously by using  `{start_of_variant: append_content}`.

Lastly, though less common, it might happen that a part has a variation at the start. For that, you have `{start_of_variant: replace_first_line}` and `{start_of_variant: prepend_content}`. These work analogously to their "end" counterparts.

Applying multiple variants at the same time is not possible - you'll just have to repeat yourself. ;)

### Image generation
Since it's 2024, I decided to use AI for tasks other than helping me code this thing. The `scripts/generate_images.py` script loads the lyrics of each of the songs and generates a prompt (in English) for an image generation model.

Because the songs have lyrics in many languages, it is currently (October 2024) necessary to use GPT-4o to generate the prompt based on the lyrics, as it has by far the best multilingual capabilities for tiny languages like Czech, Slovak, Finnish or Estonian. By default, the script uses GPT-4o-mini which still provides very satisfactory results (you can see for yourself in `songs/image_prompts`) at a fraction of the cost (around 0.01USD/50 songs).

Generating the prompt in English allows us to use "any old" image generation network. Because DALL-E 3 is pretty expensive (0.040-0.080$/image) and can only generate images that are 1024×1024 (which is too large/detailed for the thumbnails), I decided to just use the free [Hugging Face](https://huggingface.co/) API. In particular, I landed on the [FLUX.1-dev](https://huggingface.co/black-forest-labs/FLUX.1-dev) model for most of the illustrations. 

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

#### Changing the default values
It is possible to override the default values by specifying the constituent parts in the preamble. The implicit default settings goes as follows:
```yaml
prompt_model: gpt-4o-mini
prompt_id: v1
image_model: FLUX.1-dev
```

### Filling in missing chords
Humans are lazy, so why would you repeat yourself unnecessarily? Adding chords to repeated verses (or choruses, provided the lyrics change) is boring. But it's useful on the website when the whole song does not fit on the screen. You do not have to do this yourself though - it's the age of AI after all!

Unfortunately, based on my testing, even the larger GPT-4o sucks at this task and I'm not made of money to use o1 (and they won't let me anyways). Therefore, I turned to Anthropic AI - even their smallest model, Haiku 3.5, does a better good job with this and with the batch API, even the pricing even for the Sonnet is pretty reasonable too. You will have to extend your `secrets.yaml` as follows

```yaml
hugging_face_token: YOUR_TOKEN
openai:
  api_key: YOUR_TOKEN
  organization_id: YOUR_ORG_ID
  project_id: YOUR_PROJECT_ID
anthropic:
  api_key: YOUR_KEY
```
and run `scripts/add_missing.chords.py`. Remember to run it again within 24hrs to retrieve the results! 

The output should be acceptable as long as the incomplete verses follow the same structure (line breaks etc.) but it's still worth checking. The main thing to look out for is AI making "typos" when chords are inserted within words. It may also occasionally delete a repeated part (such as `{chorus}`).

To skip a part from having chords filled in, use the "Rec." label (e.g. `{start_of_verse: Rec.}`).

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
Website built on React+Vite, styled by [TailwindCSS](https://tailwindcss.com) and (heavily modified) [shadcn](https://ui.shadcn.com/) and uses (mainly) the following libraries:
* [Lucide](https://lucide.dev/): icons
* [chordpro-parser](https://github.com/chordproject/chorpro-parser/): parsing Chordpro in JS
* [Fuse.js](https://www.fusejs.io/): fuzzy search
* [auto-text-size](https://www.npmjs.com/package/auto-text-size): automatic sizing of chords & lyrics
* [country-flag-icons](https://www.npmjs.com/package/country-flag-icons)
* [Zustand](https://github.com/pmndrs/zustand): easier state management
* [@khmyznikov/pwa-install](https://github.com/khmyznikov/pwa-install): managing PWA popups and installation
* the API is modeled after [jsend](https://github.com/omniti-labs/jsend)

### Notes
* minimum target width is 320px (essentially no devices have a narrow screen than that)

## TODO:
* the smart ScrollButtons sometimes misbehave (TBD both why and how to fix)
* make the light theme look better (or at least look less bad, lol)
