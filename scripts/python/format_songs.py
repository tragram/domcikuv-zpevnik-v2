import re

from utils import chordpro_files


def remove_whitespaces(chordpro_lines: str):
    return [
        re.sub(" +", " ", l.strip()).replace("] ", "]").replace("]𝄇", "] 𝄇")
        for l in chordpro_lines
    ]


def replace_repetitions(chordpro_content: str):
    pattern = r"\|:([^{}]+?):\|"

    # Function to replace matches with the repetition symbols
    def replacer(match):
        content = match.group(1).strip()
        return f"𝄆 {content} 𝄇"

    # Replace all occurrences within the content
    return re.sub(pattern, replacer, chordpro_content)


def capitalize_lyrics(text):
    import re

    # Pattern to match the tab sections
    tab_pattern = re.compile(r"\{start_of_tab\}.*?\{end_of_tab\}", re.DOTALL)
    # Pattern to match chords/directives and lyrics
    pattern = re.compile(
        r"((?:^|\n)\s*(?:\{[^}]*\}\s*|\n)\s*)(\[[A-Ha-h0-9#mi\s]*\])?([^\n]*)"
    )

    # Protect tab sections by replacing them with placeholders
    tabs = {}
    for i, match in enumerate(tab_pattern.finditer(text)):
        placeholder = f"__TAB_SECTION_{i}__"
        tabs[placeholder] = match.group(0)  # Store the tab content
        text = text.replace(match.group(0), placeholder)  # Replace with placeholder

    # Function to capitalize the first letter of lyrics
    def capitalize_paragraph(match):
        directive_or_emptyline = (
            match.group(1) or ""
        )  # ChordPro directives or empty lines
        chord = match.group(2) or ""  # Chords
        lyrics = match.group(3) or ""  # Lyrics

        # Capitalize the first non-whitespace character in the lyrics
        capitalized_lyrics = re.sub(
            r"(?<!\S)(\S)", lambda m: m.group(1).upper(), lyrics, count=1
        )
        return directive_or_emptyline + chord + capitalized_lyrics

    # Apply capitalization to the lyrics
    text = pattern.sub(capitalize_paragraph, text)

    # Restore the tab sections
    for placeholder, original_tab in tabs.items():
        text = text.replace(placeholder, original_tab)

    return text


def format_chordpro_files():
    for file_path in chordpro_files():
        content = file_path.read_text(encoding="utf-8")
        header, separator, body = content.partition("\n\n")
        if not separator:
            continue
        formatted = "\n".join(remove_whitespaces(body.splitlines()))
        formatted = capitalize_lyrics(replace_repetitions(formatted))
        file_path.write_text(header + separator + formatted, encoding="utf-8")


if __name__ == "__main__":
    format_chordpro_files()
