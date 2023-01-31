import json
import os
from pathlib import Path
from pyknp import Juman
from natsort import natsorted, ns

input_file = 'INPUT_FILE_NAME.json'
page_offset = 1

if not os.path.exists(input_file):
    quit()

jumanpp = Juman()

pages = json.loads(Path(input_file).read_text())
for page in natsorted(pages.items()):
    page_number = int(page[0]) + page_offset
    page_lines = page[1].strip().split()

    for line in page_lines:
        result = jumanpp.analysis(line)
        for mrph in result.mrph_list():

            part_of_speech = mrph.hinsi
            base_word = mrph.genkei

            if '判定詞' == part_of_speech:
                # Skip copula.
                continue

            if '特殊' == part_of_speech:
                # Skip punctuation marks.
                continue

            if '助動詞' == part_of_speech:
                # Some of these may be worth having, but not most.  This includes はずだ, わけだ, and みたいだ.  If keeping them, the だ would have to be removed.
                continue

            if '助詞' == part_of_speech:
                # Skip particles.
                continue

            if '接尾辞' == part_of_speech:
                # Skip suffixes.
                continue

            if '接続詞' == part_of_speech:
                # Skip conjunctions.
                continue

            if '接頭辞' == part_of_speech:
                # Most of this isn't needed, but we do lose 今 in the process.
                continue

            #if '感動詞' == part_of_speech:
                # Skip a lot of あっ and わ and えー and あれっ.  Also removes ただいま, ありがとう, こんにちは, and ごめんなさい.
                #continue

            #if '未定義語' == part_of_speech:
                # Skip unknown words.  May be misparsings or manga-specific words.
                #continue

            if '名詞' == part_of_speech and 1 == len(base_word):
                # Skip one-letter nouns, such as の and ば.
                continue

            if '形容詞' == part_of_speech and base_word.endswith('だ'):
                # Remove だ from the end of adjectival nouns.
                base_word = base_word[:-1]

            if '指示詞' == part_of_speech and (base_word.endswith('な') or base_word.endswith('に')):
                base_word = base_word[:-1]

            if '副詞' == part_of_speech and base_word.endswith('で') and not base_word in ['いつまで']:
                base_word = base_word[:-1]

            has_kanji = mrph.midasi != mrph.yomi

            kanji_word = ''
            reading = ''
            if not has_kanji:
                reading = base_word
            if has_kanji:
                kanji_word = base_word
                if '/' in mrph.repname:
                    reading = mrph.repname.split('/')[1]
            print(f'{kanji_word}\t{reading}\t{page_number}\t{part_of_speech}')
