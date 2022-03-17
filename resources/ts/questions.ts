import { createElement } from './modules/dom'
import { post } from './modules/http'

interface Question {
    parent: Element;
    element: Element,
    id: string;
    type: 'freetext' | string;
    options: Option[] | undefined;
}

interface Option {
    element: Element,
    value: string;
    correct: boolean;
}

interface Answer {
    id: string;
    answers: string[];
    correct: boolean;
}

const LESSON_COMPLETED = 'lesson--completed'

const CORRECT_INDICATOR = '✓'
const INCORRECT_INDICATOR = '❏'
const ADMONITION_VISIBLE = 'admonition--visible'
const ADMONITION_SHOW = 'admonition-show'
const ADMONITION_SHOW_VISIBLE = 'admonition-show--visible'

const QUESTION = 'question'
const QUESTION_SELECTOR_FREE_TEXT = 'freetext'
const QUESTION_CORRECT = 'question--correct'
const QUESTION_INCORRECT = 'question--incorrect'
const QUESTION_SELECTOR_SELECT_IN_SOURCE = 'select-in-source'
const QUESTION_SELECTOR_INPUT_IN_SOURCE = 'input-in-source'

const OPTION = 'question-option'
const OPTION_SELECTED = 'question-option--selected'
const OPTION_CORRECT = 'question-option--correct'
const OPTION_INCORRECT = 'question-option--incorrect'

const COMMENT_SELECTOR = 'hljs-comment'
const COMMENT_SELECTOR_SELECT_PREFIX = '/*select'
const COMMENT_SELECTOR_INPUT_PREFIX = '/*input'

const CONTENT_SELECTOR = 'classroom-content'

const ANSWER_TYPE_FREETEXT = 'freetext'
const ANSWER_TYPE_CHECKED = 'checked'

const BUTTON_LOADING = 'btn--loading'

const cleanAnswer = (element: any) => {
    return element.textContent!.replace(CORRECT_INDICATOR, '').replace(INCORRECT_INDICATOR, '').replace(/^\s+|\s+$/g, '')
}

const extractAnswersFromBlock = (div: Element): Option[] => {
    return Array.from(div.querySelectorAll('ul li'))
        .map((element: any) => ({
            element,
            value: cleanAnswer(element),
            correct: element.textContent!.includes(CORRECT_INDICATOR),
        }))
}

const getQuestionDetails = (element: Element): Question => {
    const parent = element.parentElement as Element

    const question = element.querySelector('h3, h2')
    const id = question?.getAttribute('id')!

    return {
        parent,
        element,
        id,
        type: element.classList.contains(QUESTION_SELECTOR_FREE_TEXT) || element.classList.contains(QUESTION_SELECTOR_INPUT_IN_SOURCE) ? ANSWER_TYPE_FREETEXT : ANSWER_TYPE_CHECKED,
        options: undefined,
    }
}

const addHintListeners = (element: Element): void => {
    element.querySelectorAll('.admonition')
        .forEach(block => {
            const parent = block.parentElement

            const show = createElement('button', ADMONITION_SHOW, ['Show Hint'])
            show.addEventListener('click', e => {
                e.preventDefault()

                block.classList.add(ADMONITION_VISIBLE)
                // show.classList.remove(ADMONITION_SHOW_VISIBLE)
                show.parentElement?.removeChild(show)
            })

            parent?.insertBefore(show, block)
        })
}

const formatSelectionQuestion = async (element: Element): Promise<Question> => {
    const { id, type, parent, } = getQuestionDetails(element)

    // Show Checklist
    element.querySelector('.ulist')?.classList.remove('ulist')
    element.querySelector('.ulist')?.classList.add('question-options')

    const options: Option[] = extractAnswersFromBlock(element)

    const multiple = options.filter(answer => answer.correct).length > 1

    options.map(answer => {
        const input = createElement('input', '')
        input.setAttribute('id', `${id}--${answer.value}`)
        input.setAttribute('name', id as string)
        input.setAttribute('value', answer.value)
        input.setAttribute('type', multiple ? 'checkbox' : 'radio')

        input.addEventListener('change', e => {
            const target: HTMLInputElement = e.target as HTMLInputElement;

            document.querySelectorAll(`input[name="${target.getAttribute('name')}"]`)
                .forEach((inputElement) => {
                    const li: HTMLLIElement = inputElement.parentNode!.parentNode as HTMLLIElement


                    // @ts-ignore
                    if (inputElement.checked) {
                        li.classList.add(OPTION_SELECTED)
                    }
                    else {
                        li.classList.remove(OPTION_SELECTED)
                    }
                })
        })

        const label = createElement('label', 'question-option-label', [
            input,
        ])

        // Remove old nodes
        while (answer.element.hasChildNodes()) {
            const cloned = answer.element.childNodes[0].cloneNode(true)

            // TODO: Hacky
            if (cloned.nodeType !== cloned.TEXT_NODE) {
                // @ts-ignore
                cloned.innerHTML = cloned.innerHTML.replace(CORRECT_INDICATOR, '').replace(INCORRECT_INDICATOR, '')
            }

            label.appendChild(cloned)
            answer.element.removeChild(answer.element.childNodes[0])
        }

        // Add the checkbox
        answer.element.classList.add(OPTION)
        answer.element.classList.add('nice-try--no-answers-here')
        answer.element.appendChild(
            label
        )
    })

    return {
        id,
        type,
        element,
        parent,
        options,
    }
}

const formatSelectInSourceQuestion = async (element: Element): Promise<Question> => {
    const { id, type, parent, } = getQuestionDetails(element)

    // Get options from checklist
    const options: Option[] = extractAnswersFromBlock(element)

    // Remove checklist
    element.querySelectorAll('.checklist').forEach(el => {
        el.parentElement!.removeChild(el)
    })

    // Create <select>
    const select = createElement('select', 'select-in-source-select', options.map(option => {
        const el = createElement('option', '', [option.value.trim()])

        el.setAttribute('value', option.value)

        return el
    }))

    // Insert blank item at the top
    const blank = document.createElement('option')
    blank.selected = true
    select.insertBefore(blank, select.children[0])

    select.setAttribute('id', id)
    select.setAttribute('name', id as string)

    // Place <select> in the source block
    Array.from(element.querySelectorAll(`.${COMMENT_SELECTOR}`))
        .filter(el => el.innerHTML.startsWith(COMMENT_SELECTOR_SELECT_PREFIX))
        .forEach(el => {
            const parentElement = el.parentElement!

            parentElement.insertBefore(select, el)
            parentElement.removeChild(el)
        })

    return {
        parent,
        element,
        id,
        type,
        options,
    } as Question
}

const formatInputInSourceQuestion = async (element: Element): Promise<Question> => {
    const { id, type, parent, } = getQuestionDetails(element)

    // Get options from checklist
    const options: Option[] = extractAnswersFromBlock(element)

    // Remove checklist
    element.querySelectorAll('.checklist').forEach(el => {
        el.parentElement!.removeChild(el)
    })

    // Create <input>
    const input = createElement('input', 'input-in-source-select')


    input.setAttribute('id', id)
    input.setAttribute('name', id as string)

    // Place <select> in the source block
    Array.from(element.querySelectorAll(`.${COMMENT_SELECTOR}`))
        .filter(el => el.innerHTML.startsWith(COMMENT_SELECTOR_INPUT_PREFIX))
        .forEach(el => {
            const commentParent = el.parentElement!

            commentParent.insertBefore(input, el)
            commentParent.removeChild(el)
        })

    return {
        parent,
        element,
        id,
        type,
        options,
    } as Question
}

const formatFreeTextQuestion = async (element: Element): Promise<Question> => {
    const options: Option[] = extractAnswersFromBlock(element)

    // Remove Answers
    element.querySelectorAll('.checklist').forEach(el => {
        el.parentElement!.removeChild(el)
    })

    return {
        ...getQuestionDetails(element),
        options,
    }
}

const formatQuestion = async (div: Element): Promise<Question> => {
    // Add a 'show hint' link
    addHintListeners(div)

    if (div.classList.contains(QUESTION_SELECTOR_SELECT_IN_SOURCE)) {
        return formatSelectInSourceQuestion(div)
    }
    else if (div.classList.contains(QUESTION_SELECTOR_INPUT_IN_SOURCE)) {
        return formatInputInSourceQuestion(div)
    }
    else if (div.classList.contains(QUESTION_SELECTOR_FREE_TEXT)) {
        return formatFreeTextQuestion(div)
    }

    return formatSelectionQuestion(div)
}

const LESSON_OUTCOME_SELECTOR = 'lesson-outcome'
const LESSON_OUTCOME_PASSED = 'lesson-outcome--passed'
const LESSON_OUTCOME_FAILED = 'lesson-outcome--failed'

const removeFailedMessages = (parent) => {
    parent.querySelectorAll(`.${LESSON_OUTCOME_FAILED}`)
        .forEach(el => el.parentElement!.removeChild(el))
}

const handleResponse = (parent, button, res, questionsOnPage: Question[], answers: Answer[], showHint = false) => {
    // Removed failed messages
    removeFailedMessages(parent)

    // Apply answers
    questionsOnPage.map(question => {
        const response = answers.find(answer => answer!.id === question!.id)

        if (response === undefined || response!.correct === false) {
            // Set class on question
            question.element.classList.add(QUESTION_INCORRECT)
            question.element.classList.remove(QUESTION_CORRECT)

            // Show hints links
            question.element.querySelectorAll(`.${ADMONITION_SHOW}`)
                .forEach((element) => {
                    element.classList.add(ADMONITION_SHOW_VISIBLE)
                })
        }
        else {
            // Set class on question
            question.element.classList.add(QUESTION_CORRECT)
            question.element.classList.remove(QUESTION_INCORRECT)
        }

        // Set option classes
        // @ts-ignore
        question.options.map(option => {
            const selected = response?.answers.includes(option.value)
            const correct = option.correct

            if (selected && correct) {
                option.element.classList.add(OPTION_CORRECT)
                option.element.classList.remove(OPTION_INCORRECT)

            }
            else if (selected && !correct) {
                option.element.classList.remove(OPTION_CORRECT)
                option.element.classList.add(OPTION_INCORRECT)
            }
            else {
                option.element.classList.remove(OPTION_CORRECT)
                option.element.classList.remove(OPTION_INCORRECT)
            }

        })
    })

    if (res.data.completed) {
        // Remove Submit button
        button.parentElement!.removeChild(button)

        // Mark as completed in navigation
        document.querySelector('.toc-module-lesson--current')?.classList.add('toc-module-lesson--completed')

        // @ts-ignore
        for (const element of document.querySelectorAll('.summary')) {
            element.classList.add('summary--visible')
        }

        if (res.data.next) {
            displayLessonCompleted(res)

        }
        else {
            displayCourseCompleted(res)
        }

        parent.classList.remove(QUESTION_INCORRECT)
    }
    else {
        setButtonNegativeState(button)

        let children: any[] = ['It looks like you haven\'t passed the test, please try again.']

        // Show hint text?
        if (parent.querySelector('.admonition')) {
            // TODO: Show after a couple of incorrect attempts
            children = children.concat(
                '  If you are stuck, try clicking the ',
                createElement('strong', '', ['Show Hint']),
                ' button'
            )
        }

        parent.appendChild(createElement('div', `admonition admonition--warning admonition--visible ${LESSON_OUTCOME_FAILED}`, [
            createElement('h3', 'admonition-title', ['Oops!']),
            createElement('p', '', children)
        ]))

        if (showHint) {
            // Show hints links
            parent.querySelectorAll(`.${ADMONITION_SHOW}`)
                .forEach((element) => {
                    element.classList.add(ADMONITION_SHOW_VISIBLE)
                })
        }

        document.querySelector(`.${QUESTION_INCORRECT}`)?.scrollIntoView()
    }
}

const buildModuleOutcome = (title: string, buttons: HTMLElement[]): HTMLElement => {
    const summary = document.querySelector('.summary') as (HTMLElement | undefined)

    const titleElement = createElement('h2', 'module-outcome-title', [
        title
    ])

    const container = createElement('div', 'module-outcome-container', [
        titleElement,
        summary || '',
        createElement('div', 'module-outcome-actions', buttons),
    ])

    const output = createElement('div', 'module-outcome', [ container ])

    return output
}


const displayLessonCompleted = (res) => {
    const actions: HTMLElement[] = []

    // Next Link
    if ( res.data.next ) {
        actions.push(createElement('span', 'spacer', []))

        const span = document.createElement('span')
        span.innerHTML = ' &rarr;'

        const button = createElement('a', 'btn', [
            'Advance to ',
            res.data.next.title,
            span
        ])
        button.setAttribute('href', res.data.next.link)

        actions.push(button)
    }


    const confirmation = buildModuleOutcome(
        'You have passed this lesson!',
        actions,
    )

    const content = document.querySelector(`.${CONTENT_SELECTOR}`)

    if ( content ) {
        content.appendChild(confirmation)
    }
}

const displayCourseCompleted = (res) => {
    const actions: HTMLElement[] = []

    // Course Summary Link
    // @ts-ignore
    if ( window.course.summary ) {
        const span = document.createElement('span')
        span.innerHTML = ' &rarr;'

        const button = createElement('a', 'btn btn-secondary', [
            'View Course Summary',
        ])
        // @ts-ignore
        button.setAttribute('href', `${window.analytics.course.link}summary/`)
        button.setAttribute('target', '_blank')

        actions.push(button)

        actions.push(createElement('span', 'spacer', []))
    }

    // Certificate Link
    // @ts-ignore
    if ( window.user.id ) {
        const span = document.createElement('span')
        span.innerHTML = ' &rarr;'

        const button = createElement('a', 'btn', [
            'View Certificate',
            span
        ])
        // @ts-ignore
        button.setAttribute('href', `/u/${window.user.id}/${window.analytics.course.slug}`)

        actions.push(button)
    }
    else {
        const span = document.createElement('span')
        span.innerHTML = ' &rarr;'

        const button = createElement('a', 'btn', [
            'My Courses',
            span
        ])
        // @ts-ignore
        button.setAttribute('href', `/account/courses`)

        actions.push(button)
    }

    const confirmation = buildModuleOutcome(
        'You have completed this course!',
        actions,
    )

    const content = document.querySelector(`.${CONTENT_SELECTOR}`)

    if ( content ) {
        content.appendChild(confirmation)
    }
}

const handleError = (parent, button, error) => {
    // Removed failed messages
    removeFailedMessages(parent)

    parent.appendChild(createElement('div', `admonition admonition--show admonition--warning admonition--visible ${LESSON_OUTCOME_FAILED}`, [
        createElement('h3', 'admonition-title', ['Error!']),
        createElement('p', '', [
            error.message,
        ])
    ]))

    setButtonNegativeState(button)
}

const setupAnswers = () => {
    // @ts-ignore
    for (const question of document.getElementsByClassName(QUESTION)) {
        Array.from(question.querySelectorAll(`.${COMMENT_SELECTOR}`))
            // @ts-ignore
            .filter(el => el.innerHTML.startsWith(COMMENT_SELECTOR_SELECT_PREFIX) || el.innerHTML.startsWith(COMMENT_SELECTOR_INPUT_PREFIX))
            // @ts-ignore
            .forEach((el: Element) => {
                const questionElement = el.parentElement!.parentElement!.parentElement!.parentElement!
                const correct = Array.from(questionElement.querySelectorAll('.checklist li'))
                    // @ts-ignore
                    .find(e => e.textContent.includes(CORRECT_INDICATOR))

                el.innerHTML = cleanAnswer(correct!)
                el.classList.add('code-correct')
            })

        // @ts-ignore
        for (const ulist of question.getElementsByClassName('ulist')) {
            ulist.classList.remove('ulist')

            for (const li of ulist.getElementsByTagName('li')) {
                const correct = li.innerText.startsWith(CORRECT_INDICATOR)

                // Mark as option
                li.classList.add(OPTION)
                if (correct) {
                    li.classList.add(OPTION_CORRECT)
                }

                // Remove the Incorrect indicator
                li.innerHTML = li.innerHTML.replace(INCORRECT_INDICATOR, '')
            }
        }
    }
}

const loadingIndicator = () => {
    const span = document.createElement('svg')
    span.classList.add('loading-indicator')
    span.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 3.25C6.41421 3.25 6.75 2.91421 6.75 2.5V1C6.75 0.585786 6.41421 0.25 6 0.25C5.58579 0.25 5.25 0.585786 5.25 1V2.5C5.25 2.91421 5.58579 3.25 6 3.25Z" fill="black"/>
    <path d="M4.13406 3.05305L3.07306 1.99255C2.77589 1.71033 2.30973 1.71033 2.01256 1.99255C1.71977 2.28543 1.71977 2.76018 2.01256 3.05305L3.07356 4.11355C3.21405 4.25447 3.40507 4.33333 3.60406 4.33255C3.90698 4.33208 4.17988 4.14943 4.29581 3.86957C4.41173 3.58971 4.34792 3.26758 4.13406 3.05305Z" fill="black"/>
    <path d="M0.25 6C0.25 6.41421 0.585786 6.75 1 6.75H2.5C2.91421 6.75 3.25 6.41421 3.25 6C3.25 5.58579 2.91421 5.25 2.5 5.25H1C0.585786 5.25 0.25 5.58579 0.25 6Z" fill="black"/>
    <path d="M3.47867 7.76202C3.27984 7.76127 3.08898 7.84013 2.94867 7.98102L1.88767 9.04202C1.6092 9.33763 1.61662 9.80118 1.90439 10.0877C2.19217 10.3743 2.65575 10.3797 2.95017 10.1L4.01117 9.03902C4.2251 8.82442 4.28888 8.50218 4.17282 8.22227C4.05677 7.94236 3.78368 7.75979 3.48067 7.75952L3.47867 7.76202Z" fill="black"/>
    <path d="M5.25 11C5.25 11.4142 5.58579 11.75 6 11.75C6.41421 11.75 6.75 11.4142 6.75 11V9.5C6.75 9.08579 6.41421 8.75 6 8.75C5.58579 8.75 5.25 9.08579 5.25 9.5V11Z" fill="black"/>
    <path d="M8.02428 8.00297C7.73149 8.29585 7.73149 8.7706 8.02428 9.06347L9.08528 10.124C9.3784 10.4179 9.85432 10.4186 10.1483 10.1255C10.4422 9.83235 10.4429 9.35643 10.1498 9.06247L9.08628 7.99997C8.94517 7.85931 8.7539 7.78057 8.55465 7.78113C8.35541 7.78169 8.16458 7.86151 8.02428 8.00297Z" fill="black"/>
    <path d="M11.75 6C11.75 5.58579 11.4142 5.25 11 5.25H9.5C9.08579 5.25 8.75 5.58579 8.75 6C8.75 6.41421 9.08579 6.75 9.5 6.75H11C11.4142 6.75 11.75 6.41421 11.75 6Z" fill="black"/>
    <path d="M9.52103 1.70496C9.32219 1.70421 9.13133 1.78307 8.99103 1.92396L7.93103 2.98396C7.79012 3.12465 7.71094 3.31559 7.71094 3.51471C7.71094 3.71383 7.79012 3.90478 7.93103 4.04546C8.2239 4.33825 8.69865 4.33825 8.99153 4.04546L10.052 2.98546C10.2667 2.77089 10.3309 2.44806 10.2147 2.16767C10.0984 1.88728 9.82457 1.70462 9.52103 1.70496Z" fill="black"/>
    </svg>`

    return span;
}

const createSubmitButton = (text) => {
    const button = createElement('button', 'btn btn-submit', [
        loadingIndicator(),
        createElement('span', 'btn-label', [text])
    ])

    return button
}

const setupQuestions = async () => {
    // Don't run if lesson is already completed
    const body = document.getElementsByTagName('body')[0]
    if (body && body.classList.contains(LESSON_COMPLETED)) {
        setupAnswers()
        return;
    }

    // Find Questions on page
    const questionsOnPage: Question[] = await Promise.all(
        Array.from(document.querySelectorAll<Element>('.question'))
            .map(div => formatQuestion(div))
    )

    if (questionsOnPage.length) {
        // Add Submit button
        const parent = questionsOnPage[0].parent;
        const button = createSubmitButton(`Check Answer${questionsOnPage.length > 1 ? 's' : ''}`)

        parent.appendChild(button)

        button.addEventListener('click', (buttonClickEvent) => {
            buttonClickEvent.preventDefault()

            // Gather answers
            const responses: Answer[] = questionsOnPage.map(question => {
                let answers: string[] = [];

                if (question.type === ANSWER_TYPE_FREETEXT) {
                    answers = Array.from(question.element.querySelectorAll('input'))
                        .map(input => {
                            // Trim whitespace
                            let output = input.value.trim()

                            // Remove start and end quotes
                            if (output.startsWith('"') && output.endsWith('"')) {
                                output = output.substr(1, output.length-2)
                            }

                            return output
                        })
                        .filter(value => value && value !== '')
                }
                else {
                    answers = Array.from(document.querySelectorAll(`input[name="${question.id}"]:checked, select[name="${question.id}"] option:checked`))
                        .map(element => element.getAttribute('value'))
                        .filter(value => !!value)
                        .map(value => value!.trim())
                }

                if (!answers.length) return

                // @ts-ignore
                const correctOptions = question.options.filter(option => option.correct).map(option => option.value)

                return {
                    id: question.id,
                    answers,
                    correct: answers.length === correctOptions.length && answers.every(answer => correctOptions.includes(answer!)),
                }
            })
                .filter(e => !!e) as Answer[]


            // Send Progress to API
            setButtonLoadingState(button as HTMLButtonElement)

            const label = button.querySelector('.btn-label')

            if (label) {
                label.innerHTML = 'Checking&hellip;'
            }

            post(document.location.pathname, responses)
                .then(res => handleResponse(parent, button, res, questionsOnPage, responses))
                .catch(error => handleError(parent, button, error))
        })
    }
}

const removeButtonLoadingState = (button: HTMLButtonElement) => {
    button.classList.remove(BUTTON_LOADING)
    button.removeAttribute('disabled')
}

const setButtonLoadingState = (button: HTMLButtonElement) => {
    button.classList.add(BUTTON_LOADING)
    button.classList.remove('btn--negative')

    const label = button.querySelector('.btn-label')

    if (label) {
        label.innerHTML = 'Checking&hellip;'
    }
}
const setButtonNegativeState = (button: HTMLButtonElement) => {
    removeButtonLoadingState(button)

    // button.classList.add('btn--negative')

    const label = button.querySelector('.btn-label')

    if (label) {
        label.innerHTML = 'Try again&hellip;'
    }
}

const setupVerify = () => {
    const body = document.getElementsByTagName('body')[0]

    Array.from(document.querySelectorAll('.btn-verify'))
        .map((button: Element) => {
            const parent = button.parentElement
            const b = button as HTMLButtonElement


            // Don't run if lesson is already completed
            if (body && body.classList.contains(LESSON_COMPLETED)) {
                parent?.classList.add(QUESTION_CORRECT)

                b.disabled = true
                b.innerHTML = 'Challenge Completed'

                b.classList.add('btn--correct')

                return
            }

            if (parent) {
                addHintListeners(parent)
            }

            button?.addEventListener('click', e => {
                e.preventDefault()

                setButtonLoadingState(button as HTMLButtonElement)

                post(`${document.location.pathname}verify`)
                    .then(res => handleResponse(button.parentElement!.parentElement!, button, res, [], [], true))
                    .catch(error => handleError(button.parentElement!.parentElement!, button, error))
                    .finally(() => {
                        button.classList.remove(BUTTON_LOADING)
                    })
            })
        })
}

const setupMarkAsReadButton = () => {
    // If completed, hide the container that holds the Read button
    const body = document.getElementsByTagName('body')[0]
    if (body && body.classList.contains(LESSON_COMPLETED)) {
        Array.from(document.querySelectorAll('.btn-read'))
            .map((button: Element) => {
                button.parentElement?.style.setProperty('display', 'none')
            })

        return;
    }

    Array.from(document.querySelectorAll('.btn-read'))
        .map((button: Element) => {
            button.addEventListener('click', readClickEvent => {
                readClickEvent.preventDefault()

                button.classList.add(BUTTON_LOADING)
                button.setAttribute('disabled', 'disabled')

                post(`${document.location.pathname}read`)
                    .then(res => handleResponse(button.parentElement, button, res, [], [], true))
                    .catch(error => handleError(button.parentElement, button, error))
                    .finally(() => {
                        button.classList.remove(BUTTON_LOADING)
                        button.removeAttribute('disabled')
                    })
            })
        })
}

export default function questions() {
    setupVerify()
    setupMarkAsReadButton()
    setupQuestions()
}
