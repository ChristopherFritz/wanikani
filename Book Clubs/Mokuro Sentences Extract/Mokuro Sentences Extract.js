const STORAGE_KEY = 'mokuro_indexes'
const TEXT_BOX_SELECTOR = 'div.textBox'
const PAGE_SELECTOR = 'div.page'
const PENDING_TEXT_BOX_SELECTOR = `${TEXT_BOX_SELECTOR}.pending`
const DONE_TEXT_BOX_SELECTOR = `${TEXT_BOX_SELECTOR}.done`
const NEXT_TEXT_BOX_SELECTOR = `${TEXT_BOX_SELECTOR}.next`
const ACTIVE_PAGE_SELECTOR = `${PAGE_SELECTOR}[style="display: inline-block; order: 2;"]`

function addStyleSheet() {

    const styles = `
        div.textBox::after
        {
            font-size: 1.5em;
            content : attr(data-number-on-page);
            border: solid thin black;
            padding: 0.5em;
            background-color: white;
            text-orientation: upright;
            writing-mode: horizontal-tb;
            position: absolute;
            top: -2em;
        }

        div.textBox.next {
            border-color: green !important;
        }
        `

    const styleSheet = document.createElement("style")
    styleSheet.innerText = styles
    document.head.appendChild(styleSheet)
}


function updateLocalStorage(storedIndexes) {

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedIndexes))

}

function clearLocalStorage(storedIndexes) {

    localStorage.removeItem(STORAGE_KEY)

}

function getStoredTextBoxes() {

    const restoredIndexes = []
    const restoredTextBoxes = []

    for (let storedIndex of storedIndexes) {
        const textBox = document.querySelector(`${TEXT_BOX_SELECTOR}[data-index-number="${storedIndex}"]`)
        if (null == textBox) {
            continue
        }

        restoredIndexes.push(storedIndex)
        restoredTextBoxes.push(textBox)
    }

    storedIndexes = restoredIndexes
    updateLocalStorage(storedIndexes)

    return restoredTextBoxes

}

function saveLocalStorageToFile() {

    // Collect text from all text boxes.

    let output = {}

    for (let textBox of getStoredTextBoxes()) {

        const page = textBox.closest(PAGE_SELECTOR)
        if (null == page) {
            continue
        }

        // Get the page number.
        const pageNumber = page.id.replace('page', '')

        if (!(pageNumber in output)) {
            output[pageNumber] = ''
        }

        // Cycle through the P's and get the text.
        const paragraphs = textBox.querySelectorAll('p')
        for (let paragraph of paragraphs) {
            output[pageNumber] += paragraph.textContent
        }
        output[pageNumber] += '\n'

    }

    // Get the name of the open file, and replace the extension.
    let outputFileName = decodeURIComponent(window.location).split("/").pop().replace('.html', '.json').replace('#', '')

    // Save the output to a file.
    let jsonText = JSON.stringify(output);
    let element = document.createElement('a')
    element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonText));
    element.setAttribute('download', outputFileName)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)

}

function storeTextBoxHover(e) {

    storeTextBox(e.target)

}

function storeTextBox(textBox) {

    storedIndexes.push(textBox.dataset.indexNumber)
    clickedElements.push(textBox)
    updateLocalStorage(storedIndexes)

    textBox.style.display = 'none'
    // Add a style so querySelector can know this one is "done".
    textBox.classList.add('done')
    textBox.classList.remove('pending')
    textBox.classList.remove('next')

}

function syncNextTextBox(page) {

    const nextTextBoxes = page.querySelectorAll(NEXT_TEXT_BOX_SELECTOR)
    for (let nextTextBox of nextTextBoxes) {
        nextTextBox.classList.remove('next')
    }

    const nextPendingTextBox = page.querySelector(PENDING_TEXT_BOX_SELECTOR)
    if (null != nextPendingTextBox) {
        nextPendingTextBox.classList.add('next')
    }

}

function restoreStoredTextBoxes() {

    for (let textBox of getStoredTextBoxes()) {
        clickedElements.push(textBox)

        textBox.style.display = 'none'
        textBox.classList.add('done')
        textBox.classList.remove('pending')
        textBox.classList.remove('next')
    }

    for (let page of pages) {
        syncNextTextBox(page)
    }

}

function undoLastTextBox() {

    if (0 === storedIndexes.length) {
        return
    }

    storedIndexes.pop()

    const textBox = clickedElements.pop()
    textBox.style.display = 'block'
    textBox.classList.remove('done')
    textBox.classList.add('pending')

    updateLocalStorage(storedIndexes)

    const page = textBox.closest(PAGE_SELECTOR)
    if (null != page) {
        syncNextTextBox(page)
    }

}

function tryToChangePage(e) {

    const page = e.target

    const textBoxes = page.querySelectorAll(`${TEXT_BOX_SELECTOR}:not(.done)`)
    if (0 === textBoxes.length) {
        inputLeft()
    }

}

let storedIndexes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []

let clickedElements = []

addStyleSheet()

const textBoxes = document.querySelectorAll(TEXT_BOX_SELECTOR)

let indexNumber = 0

for (let textBox of textBoxes) {

    indexNumber += 1
    textBox.dataset.indexNumber = indexNumber

    // Style the textbox.
    textBox.style.border = '5px solid red'
    
    // Hide the P's.
    const paragraphs = textBox.querySelectorAll('p')
    for (let paragraph of paragraphs) {
        paragraph.style.display = 'none'
    }

    // Change the appearance of the textbox on hover.
    textBox.addEventListener('mouseover', storeTextBoxHover)

}

// When the mouse moves off the page, check whether to move to the next page.
const pages = document.querySelectorAll(PAGE_SELECTOR)
for (let page of pages) {
    page.addEventListener('mouseleave', tryToChangePage)

    // Add a per-page number to each textbox on the page.
    const pageTextBoxes = page.querySelectorAll(TEXT_BOX_SELECTOR)
    let boxNumber = 0
    for (let pageTextBox of pageTextBoxes) {
        boxNumber += 1

        pageTextBox.dataset.numberOnPage = (''+boxNumber)
        pageTextBox.classList.add('pending')
    }

    syncNextTextBox(page)
}

restoreStoredTextBoxes()

let numbers = ''

// Track typing numbers.
document.addEventListener("keydown", function onEvent(e) {

    // Handle undo.
    if ('*' == e.key) {
        undoLastTextBox()
        return
    }

    // Intentionally move to the next page.
    if ('/' == e.key) {
        inputLeft()
        return
    }

    // Handle number press.
    if (/^\d$/.test(e.key)) {
        numbers += e.key
    }
    else {
        return
    }

    const currentPage = document.querySelector(ACTIVE_PAGE_SELECTOR)

    const allTextBoxes = currentPage.querySelectorAll(TEXT_BOX_SELECTOR)
    const pendingTextBoxes = currentPage.querySelectorAll(PENDING_TEXT_BOX_SELECTOR)
    const doneTextBoxes = currentPage.querySelectorAll(DONE_TEXT_BOX_SELECTOR)

    if ('0' == numbers) {
        const nextTextBox = currentPage.querySelector(NEXT_TEXT_BOX_SELECTOR)
        if (null != nextTextBox) {
            storeTextBox(nextTextBox)
        }
    }
    else {
        if ('1' == numbers && 10 <= allTextBoxes.length) {
            const pageOneDone = 0 < currentPage.querySelectorAll(`${DONE_TEXT_BOX_SELECTOR}[data-number-on-page="1"]`).length
            if (pageOneDone) {
                // Dialogue box 1 has already been selected.  This must be a teen.
                return
            }
            const donePagesCount = currentPage.querySelectorAll(DONE_TEXT_BOX_SELECTOR).length
            if (3 < donePagesCount) {
                // Chances are box 1 was skipped over intentionally, and this is part of 10 or higher.
                return
            }
        }
        const textBoxToSelect = currentPage.querySelector(`${PENDING_TEXT_BOX_SELECTOR}[data-number-on-page="${numbers}"]`)
        if (null != textBoxToSelect) {
            storeTextBox(textBoxToSelect)
        }
    }

    // If the "next" box was selected, then mark the next "next" box.
    const nextNextTextBox = currentPage.querySelector(PENDING_TEXT_BOX_SELECTOR)
    if (null != nextNextTextBox) {
        nextNextTextBox.classList.add('next')
    }

    numbers = ''

    // If this was the last number, move to the next page.
    if (1 == pendingTextBoxes.length) {
        inputLeft()
    }

})
