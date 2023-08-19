// ==UserScript==
// @name         WaniKani Kanji Review Vocabulary List
// @namespace    http://kurifuri.com/
// @version      1.1.0
// @description  Displays vocabulary words when reviewing kanji on WaniKani.
// @author       Christopher Fritz
// @match        https://www.wanikani.com/subjects/review
// @match        https://www.wanikani.com/subjects/extra_study*
// @run-at       document-end
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// ==/UserScript==

(function() {
    'use strict';

    /* global wkof */

    wkof.include('ItemData, Menu, Settings');
	wkof.ready('document,ItemData,Menu,Settings').then(load_settings).then(startup);

    let settings;

    function load_settings() {
        let defaults = {
            show_for_meaning_review: true,
            show_for_reading_review: true,
            show_for_kunyomi: true,
            show_for_onyomi: true,
            show_for_nanori: true,
            match_vocab_reading_to_kanji_answer: true,
            max_vocab_to_show: 10,
            show_locked_vocabulary: true,
            blur_vocab_list: false
        };

        return wkof.Settings.load('wkkrvl', defaults).then(function(data) {
            settings = wkof.settings.wkkrvl;

			// Migrate settings from localStorage if present
            const key = 'kf-wkkrvl-settings';

            let old_settings = {};

            if (localStorage.getItem(key) != null) {
                old_settings = JSON.parse(localStorage.getItem(key));

                localStorage.removeItem(key);

                settings.show_for_meaning_review = old_settings.show_for_meaning_review;
                settings.show_for_reading_review = old_settings.show_for_reading_review;
                settings.show_for_kunyomi = old_settings.show_for_kunyomi;
                settings.show_for_onyomi = old_settings.show_for_onyomi;
                settings.show_for_nanori = old_settings.show_for_nanori;
                settings.match_vocab_reading_to_kanji_answer = old_settings.match_vocabulary_reading_to_kanji_answer;
                settings.max_vocab_to_show = old_settings.max_vocabulary_to_show;
                settings.show_locked_vocabulary = old_settings.show_locked_vocabulary;
                settings.blur_vocab_list = old_settings.blur_vocabulary_list;

                wkof.Settings.save('wkkrvl');
            }
        });
    }

    function open_settings() {
        let dialog = new wkof.Settings({
            script_id: 'wkkrvl',
            title: 'WaniKani Kanji Review Vocabulary List',
            on_save: save_settings,
            content: {
                tabs: {type: 'tabset', content: {
                    pgMain: {type: 'page', label: 'Options', hover_tip: 'Settings for the script.', content: {
                        grpReviewTypes: {type: 'group', label: 'Show Vocabulary Words', content: {
                            show_for_meaning_review: {type: 'checkbox', label: 'For Meaning Questions', default: true, hover_tip: 'Shows vocabulary list under review questions where you are asked to give the meaning if true.'},
                            show_for_reading_review: {type: 'checkbox', label: 'For Reading Questions', default: true, hover_tip: 'Shows vocabulary list under review questions where you are asked to give the reading if true.'},
                            show_for_kunyomi: {type: 'checkbox', label: 'For Kunyomi', default: true, hover_tip: 'Shows vocabulary that use the kunyomi reading if true.'},
                            show_for_onyomi: {type: 'checkbox', label: 'For Onyomi', default: true, hover_tip: 'Shows vocabulary that use the onyomi reading if true.'},
                            show_for_nanori: {type: 'checkbox', label: 'For Nanori', default: true, hover_tip: 'Shows vocabulary that use the nanori reading if true.'}
                        }},
                        grpAdditional: {type: 'group', label: 'Additional Settings', content: {
                            match_vocab_reading_to_kanji_answer: {type: 'checkbox', label: 'Show vocabulary only if reading matches what WaniKani wants', default: true, hover_tip: 'If true, will only show vocabulary that use a reading that matches what WaniKani is asking for.'},
                            max_vocab_to_show: {type: 'number', label: 'Max number of words to show', default: 10, min: 1, max: 100, hover_tip: 'The maximum number of vocabulary words to show when the list is displayed. Between 1 and 100.'},
                            show_locked_vocabulary: {type: 'checkbox', label: 'Show Locked Vocabulary', default: true, hover_tip: 'If true will show vocabulary words that you have not unlocked yet.'},
                            blur_vocab_list: {type: 'checkbox', label: 'Blur the vocabulary list', default: false, hover_tip: 'If true will blur all of the vocabulary until you hover over the list.'}
                        }}
                    }}
                }}
            }
        });

        dialog.open();
    }

    function save_settings() {
        clear_vocabulary();
        fetch_items();
    }

    function startup() {
        install_css();
        install_menu();
        fetch_items();

        // Set up an observer on the character div.  When observing the text changing, update the vocabulary list.
        var target = document.querySelector('div[data-quiz-header-target=characters]');
        var observer = new MutationObserver(function(mutations) {
            clear_vocabulary();
            fetch_items();
        });
        var observer_config = { attributes: true, childList: true, characterData: true };
        observer.observe(target, observer_config);
    }

    let list_css = `
        #kf-wkkrvl-vocabulary-list {padding: 0.5em; text-align: center; position: relative;}
        #kf-wkkrvl-vocabulary-list span {padding: 0.5em 0.75em; font-size: 3em; word-break: keep-all;}
        #kf-wkkrvl-vocabulary-list .blur {color: transparent; text-shadow: 0 0 32px rgba(0,0,0,0.5);}
        #kf-wkkrvl-vocabulary-list:hover .blur {color: inherit; text-shadow: none;}
    `

    function install_css() {
        document.head.insertAdjacentHTML('beforeend', '<style type="text/css">' + list_css + '</style>');
    }

    function install_menu() {
        wkof.Menu.insert_script_link({name:'wkkrvl',submenu:'Settings',title:'Kanji Review Vocabulary List',on_click:open_settings});
    }

    function fetch_items() {
        let srs_stages = [0,1,2,3,4,5,6,7,8,9];
        if (settings.show_locked_vocabulary) { srs_stages.push(-1); }
        var item_config = { wk_items: { options: {assignments: true}, filters: {srs: srs_stages} } };
        wkof.ItemData.get_items(item_config).then(process_items);
    }

    function load_subjects_from_queue() {
        const subjects_json = document.querySelector('script[data-quiz-queue-target=subjects]').innerHTML;
        const subjects = JSON.parse(subjects_json);
        return subjects;
    }

    function process_items(items) {
        // Index the 'items' array by item_type.
        var type_index = wkof.ItemData.get_index(items, 'item_type');
        var kan = type_index.kanji;
        var voc = type_index.vocabulary;

        var kanji_by_name = wkof.ItemData.get_index(kan, 'slug');
        var voc_by_sid = wkof.ItemData.get_index(voc, 'subject_id');

        const character_element = document.querySelector('div[data-quiz-header-target=characters]');
        // Leave if this isn't kanji.
        if (!character_element.parentNode.parentNode.classList.contains('character-header--kanji')) {
            return;
        }

        const character = character_element.textContent;

        // Get the element where vocabulary words are shown.
        let vocabulary_element = document.getElementById('kf-wkkrvl-vocabulary-list');
        if (vocabulary_element == null || vocabulary_element.value === '') {
            // If the element does not exist yet, create it.
            vocabulary_element = document.createElement('div');
            vocabulary_element.id = 'kf-wkkrvl-vocabulary-list';
            const quiz_element = document.querySelector('div[class=quiz-input]');
            quiz_element.parentNode.insertBefore(vocabulary_element, quiz_element);
        }

        const question_type = document.querySelector('span[data-quiz-input-target=questionType]').textContent;
        if (question_type === 'meaning' && !settings.show_for_meaning_review) {
            return;
        }

        const subjects = load_subjects_from_queue();
        const current_item = subjects.find(s => { return s.type === 'Kanji' && s.characters === character});
        if (current_item === undefined) {
            return;
        }

        let reading_type = current_item.primary_reading_type;
        let is_reading_review = (question_type === 'reading');
        if (is_reading_review) {
            if (!settings.show_for_reading_review) {
                return;
            }
            if (!settings.show_for_kunyomi && reading_type === 'kunyomi') {
                return;
            }
            if (!settings.show_for_onyomi && reading_type === 'onyomi') {
                return;
            }
            if (!settings.show_for_nanori && reading_type === 'nanori') {
                return;
            }
        }

        // Get the current review's kanji.
        let current_kanji = current_item.characters;
        // Get the subject ID's for this kanji's vocabulary.
        if (kanji_by_name[current_kanji] == null) { return; }
        let vocabulary_sids = kanji_by_name[current_kanji].data.amalgamation_subject_ids;
        // Get the vocabulary words for these subject ID's.
        let vocabulary_words = [];

        for (const sid of vocabulary_sids) {
            if (voc_by_sid[sid] == null) { continue; }

            // Hide vocabulary if the reading doesn't match the expected kanji reading.
            if (is_reading_review && settings.match_vocab_reading_to_kanji_answer && !readings_match(kanji_by_name[current_kanji], voc_by_sid[sid], reading_type)) {
                continue;
            }
            vocabulary_words.push(`<span lang="ja"${settings.blur_vocab_list ? ' class="blur"' : ''}>` + voc_by_sid[sid].data.slug + '</span>\n');
            if (vocabulary_words.length >= settings.max_vocab_to_show) { break; }
        }

        // Show the vocabulary words.
        vocabulary_element.innerHTML = vocabulary_words.join('');
    }

    function readings_match(kanji, vocabulary, reading_type) {
        for (const kanji_reading of kanji.data.readings) {
            // Only check kanji for the reading type being accepted as an answer.
            if (kanji_reading.type !== reading_type) {continue;}

            let no_dakuten_kanji_reading = remove_dakuten(kanji_reading.reading);
            for (const vocabulary_reading of vocabulary.data.readings) {
                if (remove_dakuten(vocabulary_reading.reading).includes(no_dakuten_kanji_reading)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Removes dakuten and handakuten.  This is necessary when filtering to show only vocabulary words whose kanji
    // shares the reading WaniKani expects to be entered for the kanji reading, as some vocabulary words use a
    // dakuten version of the reading.
    function remove_dakuten(input) {
        return input.normalize('NFD').replace('\u3099', '').replace('\u309A', '');
    }

    function clear_vocabulary() {
        let vocabulary_element = document.getElementById('kf-wkkrvl-vocabulary-list');
        if (vocabulary_element != null) {
            // Clear out any old vocabulary words.
            vocabulary_element.innerHTML = "";
        }
    }
})();
