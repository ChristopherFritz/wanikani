from natsort import natsorted, ns
from pathlib import Path
import json
import os
import requests

input_file = 'INPUT_FILE_NAME.json'
page_offset = 0

if not os.path.exists(input_file):
    quit()



def kanji_from_data(data):

    if not 'conj' in data and not 'components' in data:
        return data['text']

    if 'conj' in data:
        if 0 == len(data['conj']):
            return data['text']

        if 'reading' in data['conj'][0]:
            if not ' ' in data['conj'][0]['reading']:
                return data['conj'][0]['reading']
            elif data['text'] == data['kana']:
                # Return the kana.
                return data['conj'][0]['reading'].split(' ')[1].replace('【', '').replace('】', '')
            else:
                # Return the kanji.
                return data['conj'][0]['reading'].split(' ')[0]
        if 'via' in data['conj'][0]:
            if not ' ' in data['conj'][0]['via'][0]['reading']:
                return data['conj'][0]['via'][0]['reading']
            elif data['text'] == data['kana']:
                # Return the kana.
                return data['conj'][0]['via'][0]['reading'].split(' ')[1].replace('【', '').replace('】', '')
            else:
                # Return the kanji.
                return data['conj'][0]['via'][0]['reading'].split(' ')[0]
    elif 'components' in data:
        return data['components'][0]['text']
    else:
        return 'WORD_PENDING'


def kana_from_data(data):

    if not 'conj' in data and not 'components' in data:
        return data['kana']

    if 'conj' in data:
        if 0 == len(data['conj']):
            return data['kana']

        if 'reading' in data['conj'][0]:
            if not ' ' in data['conj'][0]['reading']:
                return data['conj'][0]['reading']
            else:
                # Return the kana.
                return data['conj'][0]['reading'].split(' ')[1].replace('【', '').replace('】', '')
        if 'via' in data['conj'][0]:
            if not ' ' in data['conj'][0]['via'][0]['reading']:
                return data['conj'][0]['via'][0]['reading']
            else:
                # Return the kana.
                return data['conj'][0]['via'][0]['reading'].split(' ')[1].replace('【', '').replace('】', '')
    elif 'components' in data:
        return data['components'][0]['kana']
    else:
        return 'WORD_PENDING'


def pos_from_data(data):
    # Note: We're grabbing the first part of speech here, which may not be accurate in context.  Since this is only used
    # to filter out certain parts of speech, it would probably be best to return all parts of speech and then filter the
    # word out from results if none of the parts of speech are valid.  For now, look only at the first one.

    if 'gloss' in data:
        return data['gloss'][0]['pos']

    if 'conj' in data:
        if 'gloss' in data['conj'][0] and data['conj'][0]['gloss']:
            return data['conj'][0]['gloss'][0]['pos']
        if 'prop' in data['conj'][0]:
            # Does this never have [] around it, or was 聞く a special case?
            return f"[{data['conj'][0]['prop'][0]['pos']}]*"

    if 'components' in data and 'gloss' in data['components'][0]:
        return f"[{data['components'][0]['gloss'][0]['pos']}]"

    return []


def gloss_from_data(data):

    if 'conj' in data and not len(data['conj']) == 0:
        if 'gloss' in data['conj'][0] and data['conj'][0]['gloss']:
            return data['conj'][0]['gloss'][0]['gloss']
        if 'via' in data['conj'][0] and data['conj'][0]['via']:
            return data['conj'][0]['via'][0]['gloss'][0]['gloss']

    if 'gloss' in data:
        return data['gloss'][0]['gloss']

    if 'components' in data and 'gloss' in data['components'][0]:
        return data['components'][0]['gloss'][0]['gloss']

    return ''


def show_output(component, page, row_number):
    kanji = kanji_from_data(component)
    kana = kana_from_data(component)
    speech = pos_from_data(component)
    gloss = gloss_from_data(component)

    if '[]' == speech or [] == speech:
        return
    elif 'prt' in speech:
        return
    elif 'pref' in speech:
        return
    elif '[aux]' == speech or '[aux-adj]' == speech or '[aux,adj-na]' == speech or "[aux-v]" == speech or "[aux-v,vr]" == speech or "[v5aru,aux-v]" == speech or "[aux-v,v5r]" == speech:
        return
    elif 'suf' in speech:
        return
    elif 'conj' in speech:
        return
    elif 'cop' in speech:
        return
    elif 'int' in speech and not 'exp' in speech:
        return
    elif 'ctr' in speech:
        return

    print(f'{kanji}\t{kana}\t{speech}\t{gloss}\t{row_number}\t{page}')



row_number = 1

pages = json.loads(Path(input_file).read_text())
for page in natsorted(pages.items()):
    page_number = int(page[0]) + page_offset
    page_lines = page[1].strip().split()

    for line in page_lines:
        if not line.strip():
            continue

        result = requests.post('http://localhost:3005/segmentation', json={"text": line.strip()})

        for section in result.json():
            for section2 in section:

                if 1 == len(section2):
                    continue

                for section4 in section2[0]:
                    if 1 == len(section4):
                        continue
                    if 'alternative' in section4[1]:
                        continue
                    if not 'components' in section4[1]:
                        show_output(section4[1], page_number, row_number)
                        row_number += 1
                        continue
                    for component in section4[1]['components']:
                        if 'suffix' in component:
                            continue
                        show_output(section4[1], page_number, row_number)
                        row_number += 1
