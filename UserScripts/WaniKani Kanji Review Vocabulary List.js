// ==UserScript==
// @name         WaniKani Kanji Review Vocabulary List
// @namespace    http://kurifuri.com/
// @version      1.0.1
// @description  Displays vocabulary words when reviewing kanji on WaniKani.
// @author       Christopher Fritz
// @match        https://www.wanikani.com/subjects/review
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// ==/UserScript==

(async function() {
    'use strict';

    /* global wkof */

    let settings = load_settings()

    function load_settings()
    {
        const key = 'kf-wkkrvl-settings';

        let loaded_settings = {}

        if (null != localStorage.getItem(key)) {
            loaded_settings = JSON.parse(localStorage.getItem(key))
        }

        // Set default values if not already set.

        // Show vocabulary words for meaning/reading reviews.  Must be true or false.
        if (null == loaded_settings.show_for_meaning_review) { loaded_settings.show_for_meaning_review = true; }
        if (null == loaded_settings.show_for_reading_review) { loaded_settings.show_for_reading_review = true; }

        // Show vocabulary words for kanji based on reading WaniKani is asking for.  Must be true or false.
        if (null == loaded_settings.show_for_kunyomi) { loaded_settings.show_for_kunyomi = true; }
        if (null == loaded_settings.show_for_onyomi ) { loaded_settings.show_for_onyomi = true; }
        if (null == loaded_settings.show_for_nanori ) { loaded_settings.show_for_nanori = true; }

        // Only show vocabulary with a reading matching the readings WaniKani is asking for (kunyomi, onyomi, or nanori).
        if (null == loaded_settings.match_vocabulary_reading_to_kanji_answer) {
            loaded_settings.match_vocabulary_reading_to_kanji_answer = true;
        }

        // Limit number of vocabulary words to be shown.  Must be an integer.
        if (null == loaded_settings.max_vocabulary_to_show) { loaded_settings.max_vocabulary_to_show = 100; }

        // Show locked vocabulary words.  Must be true or false.
        if (null == loaded_settings.show_locked_vocabulary) { loaded_settings.show_locked_vocabulary = true; }

        // Vocabulary words will be blurred until the vocabuary bar is hovered over by mouse.  Must be true or false.
        if (null == loaded_settings.blur_vocabulary_list) { loaded_settings.blur_vocabulary_list = false; }

        return loaded_settings;
    }

    function save_settings()
    {
        settings.show_for_meaning_review = document.getElementById('kf-wkkrvl-meaning').checked;
        settings.show_for_reading_review = document.getElementById('kf-wkkrvl-reading').checked;

        settings.show_for_kunyomi = document.getElementById('kf-wkkrvl-kunyomi').checked;
        settings.show_for_onyomi = document.getElementById('kf-wkkrvl-onyomi').checked;
        settings.show_for_nanori = document.getElementById('kf-wkkrvl-nanori').checked;

        settings.match_vocabulary_reading_to_kanji_answer = document.getElementById('kf-wkkrvl-matching-readings').checked;

        settings.max_vocabulary_to_show = document.getElementById('kf-wkkrvl-word-limit').value;

        settings.show_locked_vocabulary = document.getElementById('kf-wkkrvl-show-locked').checked;

        settings.blur_vocabulary_list = document.getElementById('kf-wkkrvl-blurred').checked;

        const key = 'kf-wkkrvl-settings';
        localStorage.setItem(key, JSON.stringify(settings))
    }

    function show_menu() {
        document.getElementById('kf-wkkrvl-menu').style.display = 'block';
    }

    function hide_menu() {
        document.getElementById('kf-wkkrvl-menu').style.display = 'none';
    }

    // We're only using item data.  There is no checking the user's level to hide vocabulary from later levels.
    var modules = 'item_data';
    wkof.include('ItemData');
	await wkof.ready("ItemData");

    function fetch_items()
    {
        let srs_stages = [0,1,2,3,4,5,6,7,8,9]
        if (settings.show_locked_vocabulary) { srs_stages.push(-1) }
        var item_config = { wk_items: { options: {assignments: true}, filters: {srs: srs_stages} } };
        wkof.ItemData.get_items(item_config).then(process_items);
    }

    function load_subjects_from_queue()
    {
        const subjects_json = document.querySelector('script[data-quiz-queue-target=subjects]').innerHTML;
        const subjects = JSON.parse(subjects_json)
        return subjects
    }

    function process_items(items)
    {
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
        if (vocabulary_element == null || vocabulary_element.value == '') {
            // If the element does not exist yet, create it.
            vocabulary_element = document.createElement('div');
            vocabulary_element.id = 'kf-wkkrvl-vocabulary-list';
            const quiz_element = document.querySelector('div[class=quiz-input]');
            quiz_element.parentNode.insertBefore(vocabulary_element, quiz_element);
        }

        const question_type = document.querySelector('span[data-quiz-input-target=questionType]').textContent;
        if ('meaning' == question_type && !settings.show_for_meaning_review) {
            return;
        }

        const subjects = load_subjects_from_queue();
        const current_item = subjects.find(s => { return 'Kanji' == s.type && character == s.characters});
        if (undefined == current_item) {
            return;
        }

        let reading_type = current_item.primary_reading_type;
        let is_reading_review = 'reading' == question_type;
        if (is_reading_review) {
            if (!settings.show_for_reading_review) {
                return;
            }
            if (!settings.show_for_kunyomi && 'kunyomi' === reading_type) {
                return;
            }
            if (!settings.show_for_onyomi && 'onyomi' === reading_type) {
                return;
            }
            if (!settings.show_for_nanori && 'nanori' === reading_type) {
                return;
            }
        }

        // Get the current review's kanji.
        let current_kanji = current_item.characters;
        // Get the subject ID's for this kanji's vocabulary.
        if (null == kanji_by_name[current_kanji]) { return; }
        let vocabulary_sids = kanji_by_name[current_kanji].data.amalgamation_subject_ids;
        // Get the vocabulary words for these subject ID's.
        let vocabulary_words = [];

        vocabulary_words.push('<style type="text/css">');
        vocabulary_words.push('#kf-wkkrvl-vocabulary-list {padding: 0.5em; text-align: center; position: relative;}');
        vocabulary_words.push('#kf-wkkrvl-vocabulary-list span {padding: 0.5em 0.75em; font-size: 3em; word-break: keep-all;}');
        if (settings.blur_vocabulary_list) {
            vocabulary_words.push('#kf-wkkrvl-vocabulary-list span {color: transparent; text-shadow: 0 0 32px rgba(0,0,0,0.5);}');
            vocabulary_words.push('#kf-wkkrvl-vocabulary-list:hover span {color: inherit; text-shadow: none;}');
        }
        vocabulary_words.push('</style>');

        for (const sid of vocabulary_sids) {
            if (null == voc_by_sid[sid]) { continue; }

            // Hide vocabulary if the reading doesn't match the expected kanji reading.
            if (is_reading_review && settings.match_vocabulary_reading_to_kanji_answer && !readings_match(kanji_by_name[current_kanji], voc_by_sid[sid], reading_type)) {
                continue;
            }
            vocabulary_words.push('<span lang="ja"">' + voc_by_sid[sid].data.slug + "</span>\n");
            if (vocabulary_words.length >= settings.max_vocabulary_to_show) { break; }
        }

        // Show the vocabulary words.
        vocabulary_element.innerHTML = vocabulary_words.join('');
    }

    function readings_match(kanji, vocabulary, reading_type)
    {
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
    function remove_dakuten(input)
    {
        return input.normalize('NFD').replace('\u3099', '').replace('\u309A', '');
    }

    function clear_vocabulary()
    {
        let vocabulary_element = document.getElementById('kf-wkkrvl-vocabulary-list');
        if (vocabulary_element != null) {
            // Clear out any old vocabulary words.
            vocabulary_element.innerHTML = "";
        }
    }

    function add_menu_html()
    {
        const style_html = `
            <style>
            #kf-wkkrvl-menu {
                display: none;
                position: absolute;
                top: 0;
                left: 0;
                width: 100vw;
                heigh: 100vh;
                z-index: 346;
                padding: 5em;
            }

            #kf-wkkrvl-menu>div {
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 0.4rem;
                width: 500px;
                min-height: 300px;
                margin: 0 auto;
                padding: 1.3rem;
                position: relative;
                top: 20%;
                background-color: white;
                border: 1px solid #ddd;
                border: solid thick #0af;
                border-radius: 15px;
            }

            #kf-wkkrvl-menu fieldset {
                border-width: 2px;
                border-style: groove;
                border-color: rgb(192, 192, 192);
                border-image: initial;
                padding: 10px 12px;
            }

            #kf-wkkrvl-menu input[type='number'] {
                border: solid thin #ddd;
            }
            </style>`;

        const menu_html = `
            <div id='kf-wkkrvl-menu'>

            <div>

                <fieldset>
                <legend>Show vocabulary words for which review types?</legend>
                <ul>
                <li><label><input type='checkbox' id='kf-wkkrvl-meaning'> Meaning</label>
                <li><label><input type='checkbox' id='kf-wkkrvl-reading'> Reading</label>
                </ul>
                </fieldset>

                <fieldset>
                <legend>Show vocabulary words for which readings?</legend>
                <ul>
                <li><label><input type='checkbox' id='kf-wkkrvl-kunyomi'> Kunyomi</label>
                <li><label><input type='checkbox' id='kf-wkkrvl-onyomi'> Onyomi</label>
                <li><label><input type='checkbox' id='kf-wkkrvl-nanori'> Nanori</label>
                </ul>
                </fieldset>

                <fieldset>
                <legend>Show vocabulary only if reading matches what WaniKani is asking for? (kunyomi, onyomi, or nanori)</legend>
                <ul>
                <li><label><input type='radio' id='kf-wkkrvl-matching-readings' name='kf-reading-type'> Show only if reading matches</label>
                <li><label><input type='radio' id='kf-wkkrvl-all-readings' name='kf-reading-type'> Show for all readings</label>
                </ul>
                </fieldset>

                <fieldset>
                <legend>Limit number of vocabulary words to be shown</legend>
                <ul>
                <li><label>Max words to show: <input type='number' id='kf-wkkrvl-word-limit'></label>
                </ul>
                </fieldset>

                <fieldset>
                <legend>Show locked vocabulary words?</legend>
                <ul>
                <li><label><input type='radio' id='kf-wkkrvl-show-locked' name='kf-show-locked'> Hide locked vocabulary</label>
                <li><label><input type='radio' id='kf-wkkrvl-hide-locked' name='kf-show-locked'> Show locked vocabulary</label>
                </ul>
                </fieldset>

                <fieldset>
                <legend>Blur vocabulary bar until hovered over by mouse?</legend>
                <ul>
                <li><label><input type='radio' id='kf-wkkrvl-blurred' name='kf-blur'> Blur vocabulary</label>
                <li><label><input type='radio' id='kf-wkkrvl-unblurred' name='kf-blur'> Always show vocabulary</label>
                </ul>
                </fieldset>

                <button id='kf-wkkrvl-close-settings-menu'>Close</button>
            </div>
        </div>`;

        const element = document.querySelector('div[class="quiz"]');
        element.parentNode.insertBefore(htmlToElement(style_html), element.nextSibling);
        element.parentNode.insertBefore(htmlToElement(menu_html), element.nextSibling);

        // Load settings.

        if (settings.show_for_meaning_review) { document.getElementById('kf-wkkrvl-meaning').checked = true; }
        if (settings.show_for_reading_review) { document.getElementById('kf-wkkrvl-reading').checked = true; }

        if (settings.show_for_kunyomi) { document.getElementById('kf-wkkrvl-kunyomi').checked = true; }
        if (settings.show_for_onyomi) { document.getElementById('kf-wkkrvl-onyomi').checked = true; }
        if (settings.show_for_nanori) { document.getElementById('kf-wkkrvl-nanori').checked = true; }

        if (settings.match_vocabulary_reading_to_kanji_answer) { document.getElementById('kf-wkkrvl-matching-readings').checked = true; }
        else { document.getElementById('kf-wkkrvl-all-readings').checked = true; }

        if (settings.max_vocabulary_to_show) { document.getElementById('kf-wkkrvl-word-limit').value = settings.max_vocabulary_to_show; }

        if (settings.show_locked_vocabulary) { document.getElementById('kf-wkkrvl-show-locked').checked = true; }
        else { document.getElementById('kf-wkkrvl-hide-locked').checked = true; }

        if (settings.blur_vocabulary_list) { document.getElementById('kf-wkkrvl-blurred').checked = true; }
        else { document.getElementById('kf-wkkrvl-unblurred').checked = true; }

        document.getElementById('kf-wkkrvl-meaning').addEventListener('change', save_settings, false);
        document.getElementById('kf-wkkrvl-reading').addEventListener('change', save_settings, false);
        document.getElementById('kf-wkkrvl-kunyomi').addEventListener('change', save_settings, false);
        document.getElementById('kf-wkkrvl-onyomi').addEventListener('change', save_settings, false);
        document.getElementById('kf-wkkrvl-nanori').addEventListener('change', save_settings, false);
        document.getElementById('kf-wkkrvl-matching-readings').addEventListener('change', save_settings, false);
        document.getElementById('kf-wkkrvl-all-readings').addEventListener('change', save_settings, false);
        document.getElementById('kf-wkkrvl-word-limit').addEventListener('change', save_settings, false);
        document.getElementById('kf-wkkrvl-show-locked').addEventListener('change', save_settings, false);
        document.getElementById('kf-wkkrvl-hide-locked').addEventListener('change', save_settings, false);
        document.getElementById('kf-wkkrvl-blurred').addEventListener('change', save_settings, false);
        document.getElementById('kf-wkkrvl-unblurred').addEventListener('change', save_settings, false);

        document.getElementById('kf-wkkrvl-close-settings-menu').addEventListener('click', hide_menu, false);

    }

    function htmlToElement(html) {
        let template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstChild;
    }

    // Set up an observer on the character div.  When observing the text changing, update the vocabulary list.
    var target = document.querySelector('div[data-quiz-header-target=characters]');
    var observer = new MutationObserver(function(mutations) {
        clear_vocabulary();
        fetch_items();
    });
    var observer_config = { attributes: true, childList: true, characterData: true };
    observer.observe(target, observer_config);


    // Add menu icon.
    const menu_icon_html = '<div id="kf-wkkrvl-menu-icon" style="cursor: pointer;">☰</div>';
    const menu_icon_element = htmlToElement(menu_icon_html);
    menu_icon_element.addEventListener('click', show_menu, false);
    document.querySelector('div[class="character-header__menu"]').appendChild(menu_icon_element);
    add_menu_html();

    // Run for the initial review.
    fetch_items();

})();
