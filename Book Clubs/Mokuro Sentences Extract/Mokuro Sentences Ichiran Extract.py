"""Extract vocabulary from Mokuro sentence JSON using a local Ichiran server.

Run: python3 "Mokuro Sentences Ichiran Extract.py" input.json
Requires requests and Ichiran at http://localhost:3005. Relative input paths
use this script's folder. Output is UTF-8 text with tab-separated columns:
word, kana, part of speech, gloss, row number, page number.

To start the existing Ichiran Docker image:
    sudo systemctl start docker
    docker run -p 3005:80 ichiran-docker
"""

import argparse
import json
from pathlib import Path
import sys

import requests


ICHIRAN_URL = "http://localhost:3005/segmentation"
REQUEST_TIMEOUT = 30  # Seconds.
EXCLUDED_PARTS_OF_SPEECH = {"prt", "pref", "suf", "conj", "cop", "ctr"}
EXCLUDED_AUXILIARIES = {
    "[aux]", "[aux-adj]", "[aux,adj-na]", "[aux-v]",
    "[aux-v,vr]", "[v5aru,aux-v]", "[aux-v,v5r]",
}


def conjugations_from_data(data):
    """Follow the first conjugation and any intermediate conjugations."""
    conjugations = data.get("conj") or []
    while conjugations:
        conjugation = conjugations[0]
        yield conjugation
        conjugations = conjugation.get("via") or []


def readings_from_data(data):
    """Return the dictionary form and kana, preserving kana-only spellings."""
    for conjugation in conjugations_from_data(data):
        reading = conjugation.get("reading")
        if not reading:
            continue
        word, separator, kana = reading.partition(" ")
        if not separator:
            return reading, reading
        kana = kana.strip().removeprefix("【").removesuffix("】")
        if data.get("text") == data.get("kana"):
            word = kana
        return word, kana

    word = data.get("text", "")
    return word, data.get("kana", word)


def pos_from_data(data):
    """Use the first available gloss's part of speech, as in the original."""
    sources = [data, *conjugations_from_data(data)]
    for source in sources:
        glosses = source.get("gloss") or []
        if glosses and glosses[0].get("pos"):
            return glosses[0]["pos"]
    for source in sources:
        properties = source.get("prop") or []
        if properties and properties[0].get("pos"):
            return f"[{properties[0]['pos']}]"
    return ""


def gloss_from_data(data):
    for source in [*conjugations_from_data(data), data]:
        glosses = source.get("gloss") or []
        if glosses:
            return glosses[0].get("gloss", "")
    return ""


def include_word(speech):
    tags = {tag.strip() for tag in speech.strip("[]").split(",") if tag.strip()}
    if not tags or tags & EXCLUDED_PARTS_OF_SPEECH:
        return False
    if speech in EXCLUDED_AUXILIARIES:
        return False
    return "int" not in tags or "exp" in tags


def word_components(data):
    """Extract each compound component once, omitting suffixes/alternatives."""
    if "suffix" in data or "alternative" in data:
        return
    components = data.get("components") or []
    if components:
        for component in components:
            yield from word_components(component)
    else:
        yield data


def words_from_response(result):
    """Skip Ichiran's punctuation strings and entries without word data."""
    if not isinstance(result, list):
        raise ValueError("Ichiran returned an unexpected response format.")
    for section in result:
        if isinstance(section, str):
            continue
        if not isinstance(section, list):
            raise ValueError("Ichiran returned an unexpected section format.")
        for analysis in section:
            if not isinstance(analysis, list) or not analysis:
                raise ValueError("Ichiran returned an unexpected analysis format.")
            for token in analysis[0]:
                if not isinstance(token, list) or len(token) < 2:
                    continue
                if not isinstance(token[1], dict):
                    raise ValueError("Ichiran returned unexpected word data.")
                yield from word_components(token[1])


def extract_rows(pages, session):
    row_number = 1
    for page, text in pages:
        # Mokuro separates selected text boxes with whitespace.
        for line in text.split():
            try:
                response = session.post(
                    ICHIRAN_URL, json={"text": line}, timeout=REQUEST_TIMEOUT
                )
                response.raise_for_status()
                result = response.json()
            except (requests.RequestException, ValueError) as error:
                raise ValueError(
                    f"Ichiran request failed on page {page} for {line!r}: {error}"
                ) from error

            for component in words_from_response(result):
                speech = pos_from_data(component)
                if not include_word(speech):
                    continue
                word, kana = readings_from_data(component)
                gloss = gloss_from_data(component)
                # Keep each entry on one line with exactly six TSV columns.
                fields = (word, kana, speech, gloss, row_number, int(page))
                yield "\t".join(
                    str(field).replace("\t", " ").replace("\r", " ").replace("\n", " ")
                    for field in fields
                )
                row_number += 1


def main(input_file):
    """Process the required input path and return its matching .txt path."""
    if input_file is None or not str(input_file).strip():
        raise ValueError("input_file is required; pass a JSON file path.")
    input_path = Path(input_file).expanduser()
    if input_path.suffix.lower() != ".json":
        raise ValueError(f"Input file must have a .json extension: {input_path}")
    if not input_path.is_absolute():
        input_path = Path(__file__).resolve().parent / input_path
    if not input_path.is_file():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    with input_path.open(encoding="utf-8-sig") as source:
        pages = json.load(source)
    if not isinstance(pages, dict) or not all(
        isinstance(text, str) for text in pages.values()
    ):
        raise ValueError("Input JSON must map numeric page numbers to sentence text.")
    try:
        sorted_pages = sorted(pages.items(), key=lambda item: int(item[0]))
    except ValueError as error:
        raise ValueError("Every JSON page number must be an integer.") from error

    # Finish extraction before opening the output, preserving it if Ichiran fails.
    with requests.Session() as session:
        rows = list(extract_rows(sorted_pages, session))
    output_path = input_path.with_suffix(".txt")
    output_path.write_text("\n".join(rows) + ("\n" if rows else ""), encoding="utf-8")
    print(f"Saved {len(rows)} vocabulary rows to {output_path}")
    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("input_file", help="Path to the Mokuro sentence JSON file.")
    args = parser.parse_args()
    try:
        main(args.input_file)
    except (OSError, ValueError, requests.RequestException) as error:
        sys.exit(f"Error: {error}")
