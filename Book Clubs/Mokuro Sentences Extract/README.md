# Mokuro Sentence Extract.js

A small browser-side helper script for selecting Mokuro text boxes and exporting the selected text as JSON.

## What it does

- Numbers each `div.textBox` on every Mokuro page.
- Hides paragraph text and highlights selectable boxes.
- Lets you select boxes by hovering or by typing their on-page number.
- Persists selected boxes in `localStorage` so a refresh restores progress.
- Exports selected text grouped by page number.

## Usage

1. Open a Mokuro-generated HTML file in your browser.
2. Load or paste `Mokuro Sentences Extract.js` into the page.
3. Select text boxes while reading.
4. Run `saveLocalStorageToFile()` in the browser console to download the current selection as JSON.

## Controls

- Hover a text box: mark it as selected.
- `0`: select the current `next` suggested box.
- `1`-`9` (and multi-digit input): select the numbered box on the current page.
- `*`: undo the last selection.
- `/`: move to the next page.

## Saved state

Selections are stored in `localStorage` under `mokuro_indexes`.

On reload, the script:

- restores previously selected boxes,
- removes stale saved indexes that no longer match the page DOM,
- recalculates the next pending box on each page.

## Export format

`saveLocalStorageToFile()` downloads a JSON file named after the current HTML file.

Example shape:

```json
{
  "12": "First selected sentence on page 12\nSecond selected sentence on page 12\n",
  "13": "Selected sentence on page 13\n"
}
```

## Notes

- The script currently assumes Mokuro uses `div.page` and `div.textBox` containers.
- The current page lookup depends on Mokuro's inline page display style.
- If Mokuro's DOM structure changes, update the selector constants near the top of `Mokuro Sentences Extract.js`.

# Mokuro Reader Sentences Extract.js

A userscript to do the same in Mokuro Reader.  Streamlines the experience.

# Mokuro Sentences Ichiran Extract.py

Takes output from either of the above scripts and runs it through a running Ichiran instance to segment text and output with English.

Call this script with the output JSON file as a parameter.

# Mokuro Vocabulary Tables.html

Open `Mokuro Vocabulary Tables.html` directly in a browser, then drag in the
`.txt` file created by `Mokuro Sentences Ichiran Extract.py` or use **Choose file**.
The HTML contains all its CSS and JavaScript, works offline, and keeps the file
in your browser.

- **Page number modifier** is added to each source page number. For example,
  `-2` displays source page 7 as page 5.
- **Weekly start pages** uses those adjusted page numbers. Enter numbers in
  increasing order, separated by commas or line breaks. For example, `3, 15`
  ignores pages before 3, puts pages 3–14 in week 1, and puts page 15 onward in
  week 2. Empty entries and numbers at or below the last accepted start are
  ignored, so tables remain visible while typing the next page number. Leave
  this field blank for one table covering all pages.
- Each week keeps only the first occurrence of each word in page order, using
  the Word column to identify duplicates. A word appearing in different weeks
  is included once in each of those weeks. Entries on the same page keep file
  order, and **Source row** preserves the extractor's original row number.
- Each table displays only its first ten words. Use the **Week** links above
  the tables to copy the entire week's entries as
  tab-separated text for pasting into a spreadsheet. The columns are
  **Vocab (Kanji)**, **Vocab (Kana)**, **Meaning**, **Page #**, and **Notes**.
  The header is included, page numbers include the modifier, and Notes is blank.

Tables update as settings change. The expected input is UTF-8 text with six
tab-separated columns and no header: word, kana, part of speech, meaning, row
number, and page number. Invalid files show an error with the affected line
numbers.
