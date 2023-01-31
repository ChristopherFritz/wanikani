function updateLocalStorage() {

    // TODO: Implement this.

}

function saveLocalStorageToFile() {

    // Collect text from all text boxes.

    let output = {}

    for (let storedIndex of storedIndexes) {

        const textBox = document.querySelector(`div.textBox[data-index-number="${storedIndex}"]`)

        console.log(textBox)

        // Get the page number.
        console.log(textBox.parentNode.parentNode)
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

function storeTextBox(e) {

    const textBox = e.target

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

function tryToChangePages(e) {

    const page = e.target

    const textBoxes = page.querySelectorAll('div.textBox:not(.done)')
    if (0 === textBoxes.length) {
        inputLeft()
    }

}

let storedIndexes = []
let clickedElements = []

const textBoxes = document.querySelectorAll('div.textBox')

let indexNumber = 0

// TODO: Implement loading local storage and matching DIVs as already added for stored indexes.

for (let textBox of textBoxes) {

    indexNumber += 1
    textBox.dataset.indexNumber = indexNumber

    // Style the textbox.
    textBox.style.backgroundColor = 'yellow'
    textBox.style.border = '5px solid red'
    textBox.style.opacity = 0.5

    // Hide the P's.
    const paragraphs = textBox.querySelectorAll('p')
    for (let paragraph of paragraphs) {
        paragraph.style.display = 'none'
    }

    // Change the appearance of the textbox on hover.
    textBox.addEventListener('mouseover', storeTextBox)

}

// When the mouse moves off the page, check whether to move to the next page.
const pages = document.querySelectorAll('div.page')
for (let page of pages) {
   page.addEventListener('mouseleave', tryToChangePages)
}

