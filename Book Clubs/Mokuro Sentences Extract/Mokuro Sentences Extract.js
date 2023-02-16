function addStyleSheet() {

    const styles = `
        div.textbox::after
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
        `

    const styleSheet = document.createElement("style")
    styleSheet.innerText = styles
    document.head.appendChild(styleSheet)
}


function updateLocalStorage() {

    // TODO: Implement this.

}

function saveLocalStorageToFile() {

    // Collect text from all text boxes.

    let output = {}

    for (let storedIndex of storedIndexes) {

        const textBox = document.querySelector(`div.textBox[data-index-number="${storedIndex}"]`)

        // Get the page number.
        const pageNumber = textBox.parentNode.parentNode.id.replace('page', '')

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
    updateLocalStorage()

    textBox.style.display = 'none'
    // Add a style so querySelector can know this one is "done".
    textBox.classList.add('done')

}

function undoLastTextBox() {

    if (0 === storedIndexes.length) {
        return
    }

    storedIndexes.pop()

    const textBox = clickedElements.pop()
    textBox.style.display = 'block'
    textBox.classList.remove('done')

}

function tryToChangePage(e) {

    const page = e.target

    const textBoxes = page.querySelectorAll('div.textBox:not(.done)')
    if (0 === textBoxes.length) {
        inputLeft()
    }

}

let storedIndexes = []
let clickedElements = []

addStyleSheet()

const textBoxes = document.querySelectorAll('div.textBox')

let indexNumber = 0

// TODO: Implement loading local storage and matching DIVs as already added for stored indexes.

for (let textBox of textBoxes) {

    indexNumber += 1
    textBox.dataset.indexNumber = indexNumber

    // Style the textbox.
    //textBox.style.backgroundColor = 'yellow'
    textBox.style.border = '5px solid red'
    //textBox.style.opacity = 0.5

    // Hide the P's.
    const paragraphs = textBox.querySelectorAll('p')
    for (let paragraph of paragraphs) {
        paragraph.style.display = 'none'
    }

    // Change the appearance of the textbox on hover.
    textBox.addEventListener('mouseover', storeTextBoxHover)

}

// When the mouse moves off the page, check whether to move to the next page.
const pages = document.querySelectorAll('div.page')
for (let page of pages) {
   page.addEventListener('mouseleave', tryToChangePage)

   // Add a per-page number to each textbox on the page.
   const pageTextBoxes = page.querySelectorAll('div.textbox')
   //const boxCount = pageTextBoxes.length
   //const padding = (''+boxCount).length
   let boxNumber = 0
   for (let pageTextBox of pageTextBoxes) {
       boxNumber += 1

       pageTextBox.dataset.numberOnPage = (''+boxNumber) //.padStart(padding, '0')
    }

}

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

    // Maybe . to "submit", and * to "undo"?
    const currentPage = document.querySelector('div.page[style="display: inline-block; order: 2;"]')
    const textBoxes = currentPage.querySelectorAll('div.textBox')
    const doneTextBoxes = currentPage.querySelectorAll('div.textBox.done')
    if ('1' == numbers && 10 <= textBoxes.length) {
        const pageOneDone = 0 < currentPage.querySelectorAll('div.textBox.done[data-number-on-page="1"]').length
        if (pageOneDone) {
            // Dialogue box 1 has already been selected.  This must be a teen.
            return
        }
        const donePagesCount = currentPage.querySelectorAll('div.textBox.done').length
        if (3 < donePagesCount) {
            // Chances are box 1 was skipped over intentionally, and this is part of 10 or higher.
            return
        }
    }

    const textBoxToSelect = currentPage.querySelector(`div.textBox[data-number-on-page="${numbers}"]`)
    if (null != textBoxToSelect) {
        storeTextBox(textBoxToSelect)
    }

    numbers = ''

    // If this was the last number, move to the next page.
    if (doneTextBoxes.length + 1 == textBoxes.length) {
        inputLeft()
    }

})
