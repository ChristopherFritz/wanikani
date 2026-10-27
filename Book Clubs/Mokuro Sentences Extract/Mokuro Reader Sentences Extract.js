// ==UserScript==
// @name         Mokuro Reader Sentences Extract
// @namespace    https://reader.mokuro.app/
// @version      1.0.0
// @description  Hover to collect OCR boxes in Mokuro Reader and persist overlays across page changes.
// @match        *://*/*
// @grant        none
    // @license      MIT
// ==/UserScript==

(function () {
    'use strict'

    const STORAGE_KEY_PREFIX = 'mokuro_sentence_extract_entries'
    const STYLE_ID = 'mokuro-sentence-extract-style'
    const PANEL_SELECTOR = '#manga-panel'
    const SPREAD_SELECTOR = `${PANEL_SELECTOR} > div`
    const PAGE_SELECTOR = `${SPREAD_SELECTOR} > div.relative`
    const TEXT_BOX_SELECTOR = 'div.textBox'
    const READY_CLASS = 'mokuro-extract-ready'
    const PENDING_CLASS = 'mokuro-extract-pending'
    const DONE_CLASS = 'mokuro-extract-done'
    const NEXT_CLASS = 'mokuro-extract-next'
    const DOWNLOAD_BUTTON_ID = 'mokuro-extract-download-button'
    const CLEAR_PROMPT_ID = 'mokuro-extract-clear-prompt'
    const DATA_KEY = 'mokuroExtractKey'
    const DATA_PAGE = 'mokuroPageNumber'
    const DATA_BOX_INDEX = 'mokuroBoxIndexOnPage'
    const DATA_DISPLAY_NUMBER = 'mokuroDisplayNumber'
    const REAPPLY_DELAY_MS = 40

    const state = {
        entries: [],
        numbers: '',
        panelObserver: null,
        bodyObserver: null,
        panel: null,
        lastPageDetail: null,
        reapplyTimer: null,
        downloadButton: null,
        clearPrompt: null,
        clearPromptResolver: null,
        clearPromptLastFocus: null,
        storageKey: '',
        started: false
    }

    function getReaderHashSegments() {
        const hash = window.location.hash || ''
        const [hashPath] = hash.split('?')
        return hashPath.replace(/^#\/?/, '').split('/').filter(Boolean)
    }

    function getVolumeIdentifier() {
        const segments = getReaderHashSegments()
        if ('reader' !== segments[0] || segments.length < 3) {
            return null
        }

        const volumeSegments = segments.slice(1)
        if ('text' === volumeSegments[volumeSegments.length - 1]) {
            volumeSegments.pop()
        }

        return volumeSegments.length > 0 ? volumeSegments.join('/') : null
    }

    function getStorageKey() {
        const volumeIdentifier = getVolumeIdentifier()
        if (!volumeIdentifier) {
            return STORAGE_KEY_PREFIX
        }

        return `${STORAGE_KEY_PREFIX}:${volumeIdentifier}`
    }

    function loadEntries() {
        try {
            const parsed = JSON.parse(localStorage.getItem(getStorageKey()) || '[]')
            if (!Array.isArray(parsed)) {
                return []
            }

            return parsed.filter((entry) => {
                return (
                    entry &&
                    'string' === typeof entry.key &&
                    Number.isFinite(entry.pageNumber) &&
                    Number.isFinite(entry.boxIndexOnPage) &&
                    'string' === typeof entry.text
                )
            })
        }
        catch (_error) {
            return []
        }
    }

    function saveEntries() {
        localStorage.setItem(state.storageKey || getStorageKey(), JSON.stringify(state.entries))
    }

    function clearEntries() {
        state.entries = []
        state.numbers = ''
        localStorage.removeItem(state.storageKey || getStorageKey())
        scheduleApplyOverlay()
        updateDownloadButtonVisibility()
    }

    function syncEntriesWithCurrentVolume() {
        const storageKey = getStorageKey()
        if (storageKey === state.storageKey) {
            return false
        }

        state.storageKey = storageKey
        state.entries = loadEntries()
        state.numbers = ''
        updateDownloadButtonVisibility()
        return true
    }

    function addStyleSheet() {
        if (document.getElementById(STYLE_ID)) {
            return
        }

        const styleSheet = document.createElement('style')
        styleSheet.id = STYLE_ID
        styleSheet.textContent = `
            ${TEXT_BOX_SELECTOR}.${READY_CLASS} {
                border: 5px solid red !important;
            }

            ${TEXT_BOX_SELECTOR}.${READY_CLASS} p,
            ${TEXT_BOX_SELECTOR}.${DONE_CLASS} p {
                display: none !important;
            }

            ${TEXT_BOX_SELECTOR}.${DONE_CLASS} {
                display: none !important;
            }

            ${TEXT_BOX_SELECTOR}.${NEXT_CLASS} {
                border-color: green !important;
                box-shadow: 0 0 0 2px rgba(0, 128, 0, 0.3);
            }

            ${TEXT_BOX_SELECTOR}.${READY_CLASS}::after {
                font-size: 24px;
                line-height: 1;
                display: inline-block;
                content: attr(data-mokuro-display-number);
                border: solid thin black;
                padding: 0.25em 0.4em;
                background-color: white;
                text-orientation: upright;
                writing-mode: horizontal-tb;
                position: absolute;
                top: -2em;
                left: 0;
                z-index: 20;
                color: black;
            }

            #${DOWNLOAD_BUTTON_ID} {
                position: fixed;
                left: 24px;
                bottom: 24px;
                z-index: 2147483647;
                display: none;
                align-items: center;
                justify-content: center;
                gap: 0.5em;
                padding: 0.85em 1.2em;
                border: none;
                border-radius: 999px;
                background: #2563eb;
                color: white;
                font: 600 14px/1.2 system-ui, sans-serif;
                box-shadow: 0 12px 30px rgba(37, 99, 235, 0.35);
                cursor: pointer;
            }

            #${DOWNLOAD_BUTTON_ID}:hover {
                background: #1d4ed8;
            }

            #${DOWNLOAD_BUTTON_ID}:focus-visible {
                outline: 3px solid rgba(191, 219, 254, 0.95);
                outline-offset: 3px;
            }

            #${DOWNLOAD_BUTTON_ID}[data-visible='true'] {
                display: inline-flex;
            }

            #${CLEAR_PROMPT_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: rgba(15, 23, 42, 0.72);
            }

            #${CLEAR_PROMPT_ID}[data-visible='true'] {
                display: flex;
            }

            #${CLEAR_PROMPT_ID} [data-role='dialog'] {
                width: min(100%, 420px);
                padding: 24px;
                border-radius: 18px;
                background: #ffffff;
                color: #0f172a;
                box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
                font: 500 14px/1.5 system-ui, sans-serif;
            }

            #${CLEAR_PROMPT_ID} [data-role='title'] {
                margin: 0 0 8px;
                font: 700 18px/1.3 system-ui, sans-serif;
            }

            #${CLEAR_PROMPT_ID} [data-role='message'] {
                margin: 0;
            }

            #${CLEAR_PROMPT_ID} [data-role='actions'] {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                margin-top: 20px;
            }

            #${CLEAR_PROMPT_ID} button {
                border: none;
                border-radius: 999px;
                padding: 0.75em 1.1em;
                font: 600 14px/1.2 system-ui, sans-serif;
                cursor: pointer;
            }

            #${CLEAR_PROMPT_ID} button[data-action='cancel'] {
                background: #e2e8f0;
                color: #0f172a;
            }

            #${CLEAR_PROMPT_ID} button[data-action='confirm'] {
                background: #2563eb;
                color: #ffffff;
            }

            #${CLEAR_PROMPT_ID} button:focus-visible {
                outline: 3px solid rgba(37, 99, 235, 0.35);
                outline-offset: 2px;
            }
        `
        document.head.appendChild(styleSheet)
    }

    function resolveClearPrompt(shouldClear) {
        if (null == state.clearPromptResolver) {
            return
        }

        const prompt = state.clearPrompt
        if (prompt instanceof HTMLElement) {
            prompt.dataset.visible = 'false'
            prompt.hidden = true
        }

        const lastFocus = state.clearPromptLastFocus
        if (lastFocus instanceof HTMLElement && document.contains(lastFocus)) {
            lastFocus.focus()
        }

        state.clearPromptLastFocus = null

        const resolver = state.clearPromptResolver
        state.clearPromptResolver = null
        resolver(shouldClear)
    }

    function getClearPrompt() {
        if (state.clearPrompt instanceof HTMLElement && document.body?.contains(state.clearPrompt)) {
            return state.clearPrompt
        }

        if (!document.body) {
            return null
        }

        const existingPrompt = document.getElementById(CLEAR_PROMPT_ID)
        if (existingPrompt instanceof HTMLElement) {
            state.clearPrompt = existingPrompt
            return existingPrompt
        }

        const prompt = document.createElement('div')
        prompt.id = CLEAR_PROMPT_ID
        prompt.hidden = true
        prompt.dataset.visible = 'false'

        const dialog = document.createElement('div')
        dialog.dataset.role = 'dialog'
        dialog.setAttribute('role', 'dialog')
        dialog.setAttribute('aria-modal', 'true')
        dialog.setAttribute('aria-labelledby', `${CLEAR_PROMPT_ID}-title`)
        dialog.setAttribute('aria-describedby', `${CLEAR_PROMPT_ID}-message`)
        dialog.tabIndex = -1

        const title = document.createElement('h2')
        title.id = `${CLEAR_PROMPT_ID}-title`
        title.dataset.role = 'title'
        title.textContent = 'Download complete'

        const message = document.createElement('p')
        message.id = `${CLEAR_PROMPT_ID}-message`
        message.dataset.role = 'message'
        message.textContent = 'Clear the saved extracted sentences from local storage now?'

        const actions = document.createElement('div')
        actions.dataset.role = 'actions'

        const keepButton = document.createElement('button')
        keepButton.type = 'button'
        keepButton.dataset.action = 'cancel'
        keepButton.textContent = 'Keep data'
        keepButton.addEventListener('click', () => {
            resolveClearPrompt(false)
        })

        const clearButton = document.createElement('button')
        clearButton.type = 'button'
        clearButton.dataset.action = 'confirm'
        clearButton.textContent = 'Clear data'
        clearButton.addEventListener('click', () => {
            resolveClearPrompt(true)
        })

        actions.append(keepButton, clearButton)
        dialog.append(title, message, actions)
        prompt.appendChild(dialog)

        prompt.addEventListener('click', (event) => {
            if (event.target === prompt) {
                resolveClearPrompt(false)
            }
        })

        prompt.addEventListener('keydown', (event) => {
            if ('Escape' === event.key) {
                event.preventDefault()
                resolveClearPrompt(false)
            }
        })

        document.body.appendChild(prompt)
        state.clearPrompt = prompt
        return prompt
    }

    function promptToClearEntriesAfterDownload() {
        if (0 === state.entries.length) {
            return Promise.resolve(false)
        }

        if (null != state.clearPromptResolver) {
            return Promise.resolve(false)
        }

        const prompt = getClearPrompt()
        if (!(prompt instanceof HTMLElement)) {
            return Promise.resolve(window.confirm('Downloaded extracted sentences. Clear saved data from local storage now?'))
        }

        state.clearPromptLastFocus = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null

        prompt.hidden = false
        prompt.dataset.visible = 'true'

        const confirmButton = prompt.querySelector('button[data-action="confirm"]')
        if (confirmButton instanceof HTMLButtonElement) {
            window.setTimeout(() => {
                confirmButton.focus()
            }, 0)
        }

        return new Promise((resolve) => {
            state.clearPromptResolver = resolve
        })
    }

    function isReaderView() {
        const segments = getReaderHashSegments()
        return segments[0] === 'reader' && segments.length >= 3 && segments[3] !== 'text'
    }

    function getPanel() {
        return document.querySelector(PANEL_SELECTOR)
    }

    function getSpread() {
        return document.querySelector(SPREAD_SELECTOR)
    }

    function getPageElements() {
        const spread = getSpread()
        if (null == spread) {
            return []
        }

        return Array.from(spread.children).filter((element) => {
            return element instanceof HTMLElement && element.classList.contains('relative')
        })
    }

    function getSelectedKeys() {
        return new Set(state.entries.map((entry) => entry.key))
    }

    function escapeSelectorValue(value) {
        if ('function' === typeof CSS?.escape) {
            return CSS.escape(value)
        }

        return String(value).replace(/(["\\])/g, '\\$1')
    }

    function parsePageNumbersFromDisplay() {
        const pageDisplay = document.getElementById('page-num')
        if (null == pageDisplay) {
            return []
        }

        const numbers = (pageDisplay.textContent || '').match(/\d+/g) || []
        if (numbers.length >= 2 && pageDisplay.textContent?.includes(',')) {
            return numbers.slice(0, 2).map((value) => Number.parseInt(value, 10))
        }
        if (numbers.length >= 1) {
            return [Number.parseInt(numbers[0], 10)]
        }

        return []
    }

    function getVisiblePageContexts() {
        const pageElements = getPageElements()
        if (0 === pageElements.length) {
            return []
        }

        if (1 === pageElements.length) {
            const pageNumber = Number.isFinite(state.lastPageDetail?.currentPage)
                ? state.lastPageDetail.currentPage
                : parsePageNumbersFromDisplay()[0]

            return [{ element: pageElements[0], pageNumber: pageNumber || 1 }]
        }

        const currentPage = Number.isFinite(state.lastPageDetail?.currentPage)
            ? state.lastPageDetail.currentPage
            : parsePageNumbersFromDisplay()[0]

        if (Number.isFinite(currentPage)) {
            return [
                { element: pageElements[0], pageNumber: currentPage + 1 },
                { element: pageElements[1], pageNumber: currentPage }
            ]
        }

        const parsedNumbers = parsePageNumbersFromDisplay()
        if (parsedNumbers.length >= 2) {
            return [
                { element: pageElements[0], pageNumber: parsedNumbers[1] },
                { element: pageElements[1], pageNumber: parsedNumbers[0] }
            ]
        }

        return pageElements.map((element, index) => ({ element, pageNumber: index + 1 }))
    }

    function extractTextFromTextBox(textBox) {
        const paragraphs = textBox.querySelectorAll('p')
        let text = ''
        for (const paragraph of paragraphs) {
            text += paragraph.textContent || ''
        }
        return text
    }

    function findEntryIndexByKey(key) {
        return state.entries.findIndex((entry) => entry.key === key)
    }

    function buildEntryFromTextBox(textBox) {
        const key = textBox.dataset[DATA_KEY]
        const pageNumber = Number.parseInt(textBox.dataset[DATA_PAGE] || '', 10)
        const boxIndexOnPage = Number.parseInt(textBox.dataset[DATA_BOX_INDEX] || '', 10)

        if (!key || !Number.isFinite(pageNumber) || !Number.isFinite(boxIndexOnPage)) {
            return null
        }

        return {
            key,
            pageNumber,
            boxIndexOnPage,
            text: extractTextFromTextBox(textBox)
        }
    }

    function markTextBoxDone(textBox) {
        textBox.classList.remove(PENDING_CLASS, NEXT_CLASS)
        textBox.classList.add(DONE_CLASS)
    }

    function markTextBoxPending(textBox) {
        textBox.classList.remove(DONE_CLASS, NEXT_CLASS)
        textBox.classList.add(PENDING_CLASS)
    }

    function syncNextTextBox() {
        const spread = getSpread()
        if (null == spread) {
            return
        }

        const nextTextBoxes = spread.querySelectorAll(`${TEXT_BOX_SELECTOR}.${NEXT_CLASS}`)
        for (const nextTextBox of nextTextBoxes) {
            nextTextBox.classList.remove(NEXT_CLASS)
        }

        const nextPendingTextBox = spread.querySelector(`${TEXT_BOX_SELECTOR}.${PENDING_CLASS}`)
        if (null != nextPendingTextBox) {
            nextPendingTextBox.classList.add(NEXT_CLASS)
        }
    }

    function restoreStoredTextBoxes() {
        const selectedKeys = getSelectedKeys()
        const textBoxes = document.querySelectorAll(TEXT_BOX_SELECTOR)

        for (const textBox of textBoxes) {
            const key = textBox.dataset[DATA_KEY]
            if (!key) {
                continue
            }

            if (selectedKeys.has(key)) {
                markTextBoxDone(textBox)
            }
            else {
                markTextBoxPending(textBox)
            }
        }

        syncNextTextBox()
    }

    function storeTextBox(textBox) {
        if (!(textBox instanceof HTMLElement)) {
            return
        }

        const entry = buildEntryFromTextBox(textBox)
        if (null == entry) {
            return
        }

        if (-1 !== findEntryIndexByKey(entry.key)) {
            return
        }

        state.entries.push(entry)
        saveEntries()
        markTextBoxDone(textBox)
        syncNextTextBox()
        updateDownloadButtonVisibility()

        if (0 === getPendingTextBoxes().length) {
            advancePage()
        }
    }

    function storeTextBoxHover(event) {
        const textBox = event.currentTarget
        if (textBox instanceof HTMLElement) {
            storeTextBox(textBox)
        }
    }

    function getPendingTextBoxes() {
        const spread = getSpread()
        if (null == spread) {
            return []
        }

        return Array.from(spread.querySelectorAll(`${TEXT_BOX_SELECTOR}.${PENDING_CLASS}`))
    }

    function undoLastTextBox() {
        if (0 === state.entries.length) {
            return
        }

        const lastEntry = state.entries.pop()
        saveEntries()
        if (!lastEntry) {
            return
        }

        const textBox = document.querySelector(`${TEXT_BOX_SELECTOR}[data-mokuro-extract-key="${escapeSelectorValue(lastEntry.key)}"]`)
        if (textBox instanceof HTMLElement) {
            markTextBoxPending(textBox)
        }

        syncNextTextBox()
        updateDownloadButtonVisibility()
    }

    function tryToChangePage() {
        if (0 === getPendingTextBoxes().length) {
            advancePage()
        }
    }

    function getKeyboardDispatchTarget() {
        if (document.activeElement instanceof HTMLElement) {
            return document.activeElement
        }

        if (document.body instanceof HTMLElement) {
            return document.body
        }

        if (document.documentElement instanceof HTMLElement) {
            return document.documentElement
        }

        return window
    }

    function getTextBoxByDisplayNumber(numberText) {
        const spread = getSpread()
        if (null == spread) {
            return null
        }

        return spread.querySelector(
            `${TEXT_BOX_SELECTOR}.${PENDING_CLASS}[data-mokuro-display-number="${escapeSelectorValue(numberText)}"]`
        )
    }

    function advancePage() {
        const pageDownEvent = new KeyboardEvent('keydown', {
            key: 'PageDown',
            code: 'PageDown',
            bubbles: true,
            cancelable: true
        })

        getKeyboardDispatchTarget().dispatchEvent(pageDownEvent)
    }

    function updateTextBoxesForCurrentPages() {
        if (!isReaderView()) {
            return
        }

        const contexts = getVisiblePageContexts()
        if (0 === contexts.length) {
            return
        }

        let displayNumber = 0

        for (const { element, pageNumber } of contexts) {
            const textBoxes = element.querySelectorAll(TEXT_BOX_SELECTOR)
            let boxIndexOnPage = 0

            for (const textBox of textBoxes) {
                if (!(textBox instanceof HTMLElement)) {
                    continue
                }

                displayNumber += 1
                boxIndexOnPage += 1

                textBox.dataset[DATA_PAGE] = `${pageNumber}`
                textBox.dataset[DATA_BOX_INDEX] = `${boxIndexOnPage}`
                textBox.dataset[DATA_KEY] = `${pageNumber}:${boxIndexOnPage}`
                textBox.dataset[DATA_DISPLAY_NUMBER] = `${displayNumber}`

                textBox.classList.add(READY_CLASS)
                textBox.classList.remove(DONE_CLASS, NEXT_CLASS)

                if (!textBox.dataset.mokuroExtractHoverBound) {
                    textBox.dataset.mokuroExtractHoverBound = 'true'
                    textBox.addEventListener('mouseenter', storeTextBoxHover)
                }
            }
        }

        restoreStoredTextBoxes()

        const spread = getSpread()
        if (spread instanceof HTMLElement && !spread.dataset.mokuroExtractMouseleaveBound) {
            spread.dataset.mokuroExtractMouseleaveBound = 'true'
            spread.addEventListener('mouseleave', tryToChangePage)
        }
    }

    function scheduleApplyOverlay() {
        window.clearTimeout(state.reapplyTimer)
        state.reapplyTimer = window.setTimeout(() => {
            updateTextBoxesForCurrentPages()
        }, REAPPLY_DELAY_MS)
    }

    function observePanel() {
        const panel = getPanel()
        if (panel === state.panel) {
            return
        }

        if (state.panelObserver) {
            state.panelObserver.disconnect()
            state.panelObserver = null
        }

        state.panel = panel

        if (null == panel) {
            return
        }

        state.panelObserver = new MutationObserver(() => {
            scheduleApplyOverlay()
        })
        state.panelObserver.observe(panel, { childList: true, subtree: true })
        scheduleApplyOverlay()
    }

    function observeDocumentForReaderMounts() {
        if (state.bodyObserver || !document.body) {
            return
        }

        state.bodyObserver = new MutationObserver(() => {
            if (!isReaderView()) {
                return
            }
            observePanel()
        })
        state.bodyObserver.observe(document.body, { childList: true, subtree: true })
    }

    async function saveLocalStorageToFile() {
        const output = {}

        const sortedEntries = [...state.entries].sort((left, right) => {
            if (left.pageNumber !== right.pageNumber) {
                return left.pageNumber - right.pageNumber
            }
            return left.boxIndexOnPage - right.boxIndexOnPage
        })

        for (const entry of sortedEntries) {
            if (!(entry.pageNumber in output)) {
                output[entry.pageNumber] = ''
            }
            output[entry.pageNumber] += `${entry.text}\n`
        }

        const jsonText = JSON.stringify(output)
        const outputFileName = `${sanitizeFileName(document.title || 'mokuro-reader-sentences')}.json`
        const element = document.createElement('a')
        element.setAttribute('href', `data:application/json;charset=utf-8,${encodeURIComponent(jsonText)}`)
        element.setAttribute('download', outputFileName)
        element.style.display = 'none'
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)

        if (await promptToClearEntriesAfterDownload()) {
            clearEntries()
        }
    }

    function getDownloadButton() {
        if (state.downloadButton instanceof HTMLButtonElement && document.body?.contains(state.downloadButton)) {
            return state.downloadButton
        }

        if (!document.body) {
            return null
        }

        const existingButton = document.getElementById(DOWNLOAD_BUTTON_ID)
        if (existingButton instanceof HTMLButtonElement) {
            state.downloadButton = existingButton
            return existingButton
        }

        const button = document.createElement('button')
        button.id = DOWNLOAD_BUTTON_ID
        button.type = 'button'
        button.textContent = 'Download JSON'
        button.setAttribute('aria-label', 'Download extracted sentences as JSON')
        button.addEventListener('click', saveLocalStorageToFile)
        document.body.appendChild(button)
        state.downloadButton = button
        return button
    }

    function isLastVisiblePage() {
        const currentPage = state.lastPageDetail?.currentPage
        const totalPages = state.lastPageDetail?.totalPages

        if (!Number.isFinite(currentPage) || !Number.isFinite(totalPages)) {
            return false
        }

        const visiblePageCount = Math.max(getPageElements().length, 1)
        return currentPage + visiblePageCount - 1 >= totalPages
    }

    function updateDownloadButtonVisibility() {
        const button = getDownloadButton()
        if (!(button instanceof HTMLButtonElement)) {
            return
        }

        const shouldShow = isReaderView() && isLastVisiblePage()
        button.dataset.visible = shouldShow ? 'true' : 'false'
        button.hidden = !shouldShow
        button.disabled = 0 === state.entries.length
        button.title = 0 === state.entries.length
            ? 'No extracted entries to download yet'
            : 'Download extracted sentences as JSON'
    }

    function sanitizeFileName(fileName) {
        return fileName
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\.+$/, '') || 'mokuro-reader-sentences'
    }

    function handlePageChange(event) {
        state.lastPageDetail = event.detail || null
        syncEntriesWithCurrentVolume()
        observePanel()
        scheduleApplyOverlay()
        updateDownloadButtonVisibility()
    }

    function shouldIgnoreKeyboardEvent(event) {
        const target = event.target
        if (!(target instanceof HTMLElement)) {
            return false
        }

        return (
            'INPUT' === target.tagName ||
            'TEXTAREA' === target.tagName ||
            target.isContentEditable
        )
    }

    function handleKeyDown(event) {
        if (!isReaderView() || shouldIgnoreKeyboardEvent(event)) {
            return
        }

        if ('*' === event.key) {
            event.preventDefault()
            state.numbers = ''
            undoLastTextBox()
            return
        }

        if ('/' === event.key || 'Slash' === event.code) {
            event.preventDefault()
            state.numbers = ''
            advancePage()
            return
        }

        if (!/^\d$/.test(event.key)) {
            return
        }

        event.preventDefault()
        state.numbers += event.key

        const spread = getSpread()
        if (null == spread) {
            state.numbers = ''
            return
        }

        const allTextBoxes = spread.querySelectorAll(`${TEXT_BOX_SELECTOR}.${READY_CLASS}`)

        if ('0' === state.numbers) {
            const nextTextBox = spread.querySelector(`${TEXT_BOX_SELECTOR}.${NEXT_CLASS}`)
            if (nextTextBox instanceof HTMLElement) {
                storeTextBox(nextTextBox)
            }
            state.numbers = ''
            return
        }

        if ('1' === state.numbers && 10 <= allTextBoxes.length) {
            const firstBoxDone = 0 < spread.querySelectorAll(`${TEXT_BOX_SELECTOR}.${DONE_CLASS}[data-mokuro-display-number="1"]`).length
            if (firstBoxDone) {
                return
            }

            const doneCount = spread.querySelectorAll(`${TEXT_BOX_SELECTOR}.${DONE_CLASS}`).length
            if (3 < doneCount) {
                return
            }
        }

        const textBoxToSelect = getTextBoxByDisplayNumber(state.numbers)
        if (textBoxToSelect instanceof HTMLElement) {
            storeTextBox(textBoxToSelect)
        }

        state.numbers = ''
    }

    function handleHashChange() {
        syncEntriesWithCurrentVolume()

        if (!isReaderView()) {
            if (state.panelObserver) {
                state.panelObserver.disconnect()
                state.panelObserver = null
            }
            state.panel = null
            updateDownloadButtonVisibility()
            return
        }

        observePanel()
        scheduleApplyOverlay()
        updateDownloadButtonVisibility()
    }

    function start() {
        if (state.started) {
            return
        }

        state.started = true
        syncEntriesWithCurrentVolume()
        addStyleSheet()
        getDownloadButton()
        document.addEventListener('mokuro-reader:page.change', handlePageChange)
        window.addEventListener('hashchange', handleHashChange)
        document.addEventListener('keydown', handleKeyDown, true)
        observeDocumentForReaderMounts()
        handleHashChange()
    }

    start()

    window.mokuroSentenceExtract = {
        exportSelections: saveLocalStorageToFile,
        clearSelections: clearEntries,
        reapplyOverlay: scheduleApplyOverlay,
        getSelections: () => [...state.entries]
    }
})()
