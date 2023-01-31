// ==UserScript==
// @name         WaniKani Kanji Review Vocabulary List
// @namespace    http://kurifuri.com/
// @version      0.5.4
// @description  Displays vocabulary words when reviewing kanji on WaniKani.
// @author       Christopher Fritz
// @match        https://www.wanikani.com/review/session
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// ==/UserScript==

(async function() {
    'use strict';

    /* global wkof */

    // ****************************************************************************************************/
    // ** CONFiGURATION ***********************************************************************************/
    // ****************************************************************************************************/
    // Since there is no configuration window, options may be set here.  If this script is updated, you
    // will need to manually set these options again.  (Sorry!)

    // Show vocabulary words for meaning/reading reviews.  Must be true or false.
    const SHOW_FOR_MEANING_REVIEW = true
    const SHOW_FOR_READING_REVIEW = true

    // Show vocabulary words for kanji based on reading WaniKani is asking for.  Must be true or false.
    const SHOW_FOR_KUNYOMI = true
    const SHOW_FOR_ONYOMI = true
    const SHOW_FOR_NANORI = true

    // Only show vocabulary with a reading matching the readings WaniKani is asking for (kunyomi, onyomi, or nanori).
    const MATCH_VOCABULARY_READING_TO_KANJI_ANSWER = true

    // Limit number of vocabulary words to be shown.  Must be an integer.
    const MAX_VOCABULARY_TO_SHOW = 100

    // Show locked vocabulary words.  Must be true or false.
    const SHOW_LOCKED_VOCABULARY = true

    // Vocabulary words will be blurred until the vocabuary bar is hovered over by mouse.  Must be true or false.
    const BLUR_VOCABULARY_LIST = false
    // ****************************************************************************************************/

    // We're only using item data.  There is no checking the user's level to hide vocabulary from later levels.
    var modules = 'item_data';
    wkof.include('ItemData');
	await wkof.ready("ItemData");

    function fetch_items()
    {
        let srs_stages = [0,1,2,3,4,5,6,7,8,9]
        if (SHOW_LOCKED_VOCABULARY) { srs_stages.push(-1) }
        var item_config = { wk_items: { options: {assignments: true}, filters: {srs: srs_stages} } };
        wkof.ItemData.get_items(item_config).then(process_items);
    }

    function process_items(items)
    {

        // Index the 'items' array by item_type.
        var type_index = wkof.ItemData.get_index(items, 'item_type');
        var kan = type_index.kanji;
        var voc = type_index.vocabulary;

        var kanji_by_name = wkof.ItemData.get_index(kan, 'slug');
        var voc_by_sid = wkof.ItemData.get_index(voc, 'subject_id');

        let character_element = document.getElementById("character");

        // Get the element where vocabulary words are shown.
        let vocabulary_element = document.getElementById('vocabulary_list');
        if (vocabulary_element == null || vocabulary_element.value == '') {
            // If the element does not exist yet, create it.
            vocabulary_element = document.createElement("div");
            vocabulary_element.id = "vocabulary_list";
            character_element.parentNode.insertBefore(vocabulary_element, character_element.nextSibling);
        }

        // Leave if this isn't kanji.
        if (!character_element.classList.contains("kanji")) {
            return;
        }

        if (document.getElementById('question-type').classList.contains("meaning") && !SHOW_FOR_MEANING_REVIEW) {
            return;
        }

        let reading_type = $.jStorage.get('currentItem').emph;
        let is_reading_review = document.getElementById('question-type').classList.contains("reading");
        if (is_reading_review) {
            if (!SHOW_FOR_READING_REVIEW) {
                return;
            }
            if (!SHOW_FOR_KUNYOMI && 'kunyomi' === reading_type) {
                console.log("Skipping kunyomi.");
                return;
            }
            if (!SHOW_FOR_ONYOMI && 'onyomi' === reading_type) {
                console.log("Skipping onyomi.");
                return;
            }
            if (!SHOW_FOR_NANORI && 'nanori' === reading_type) {
                console.log("Skipping nanori.");
                return;
            }
        }

        // Get the current review's kanji.
        //let current_kanji = character_element.innerText;
        let current_kanji = $.jStorage.get('currentItem').kan;
        // Get the subject ID's for this kanji's vocabulary.
        if (null == kanji_by_name[current_kanji]) { return; }
        let vocabulary_sids = kanji_by_name[current_kanji].data.amalgamation_subject_ids;
        // Get the vocabulary words for these subject ID's.
        let vocabulary_words = [];

        vocabulary_words.push('<style type="text/css">');
        vocabulary_words.push('#vocabulary_list span {padding: 0.5em 0.75em; font-size: 3em; word-break: keep-all}');
        if (BLUR_VOCABULARY_LIST) {
            vocabulary_words.push('#vocabulary_list span {color: transparent; text-shadow: 0 0 32px rgba(0,0,0,0.5);}');
            vocabulary_words.push('#vocabulary_list:hover span {color: inherit; text-shadow: none;}');
        }
        vocabulary_words.push('</style>');
        for (const sid of vocabulary_sids) {
            if (null == voc_by_sid[sid]) { continue; }

            // Hide vocabulary if the reading doesn't match the expected kanji reading.
            if (is_reading_review && MATCH_VOCABULARY_READING_TO_KANJI_ANSWER && !readings_match(kanji_by_name[current_kanji], voc_by_sid[sid], reading_type)) {
                continue;
            }
            vocabulary_words.push('<span lang="ja"">' + voc_by_sid[sid].data.slug + "</span>\n");
            if (vocabulary_words.length >= MAX_VOCABULARY_TO_SHOW) { break; }
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
        let vocabulary_element = document.getElementById('vocabulary_list');
        if (vocabulary_element != null) {
            // Clear out any old vocabulary words.
            vocabulary_element.innerHTML = "";
        }
    }

    // Set up an observer on the character div.  When observing the text changing, update the vocabulary list.
    var target = document.getElementById('character');
    var observer = new MutationObserver(function(mutations) {
        clear_vocabulary();
        fetch_items();
    });
    var observer_config = { attributes: true, childList: true, characterData: true };
    observer.observe(target, observer_config);

    // Run for the initial review.
    fetch_items();

})();
