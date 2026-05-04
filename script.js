// =================================================================
// THEME MANAGEMENT - Handled in HTML inline script
// =================================================================

// At the start of script.js, near other constants
// Placeholder functions for settings actions - will be implemented step by step
window.openSettings = window.openSettings || function(event) {
    const overlay = document.getElementById('settings-modal-overlay');
    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};

window.closeSettings = window.closeSettings || function() {
    const overlay = document.getElementById('settings-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
};

window.switchSettingsSection = window.switchSettingsSection || function(section) {
    // Hide all panels
    const panels = document.querySelectorAll('.settings-panel');
    panels.forEach(panel => panel.classList.remove('active'));

    // Remove active class from all nav buttons
    const navBtns = document.querySelectorAll('.settings-nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));

    // Show selected panel
    const selectedPanel = document.getElementById(section + '-panel');
    if (selectedPanel) {
        selectedPanel.classList.add('active');
    }

    // Mark button as active
    const activeBtn = document.querySelector(`[data-section="${section}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
};

window.exportData = window.exportData || function() {
    console.log('[TODO] Export data functionality');
};

window.importDataSettings = window.importDataSettings || function() {
    console.log('[TODO] Import data functionality');
};

window.resetProgress = window.resetProgress || function() {
    console.log('[TODO] Reset progress functionality');
};

window.clearAllData = window.clearAllData || function() {
    console.log('[TODO] Clear all data functionality');
};

window.openHelp = window.openHelp || function() {
    console.log('[TODO] Open help functionality');
};
const MAX_HISTORY = 50;
const QUIZ_HISTORY_KEY = 'quiz_history';
const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || '';
let dictionaryHistory = [];
let currentHistoryIndex = -1;

// Enable guest mode access
document.addEventListener('DOMContentLoaded', () => {
    const guestBtn = document.getElementById('guest-btn');
    if (guestBtn) {
        guestBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.setItem('isGuest', 'true');
            window.location.href = 'app.html';
        });
    }
});
let words = [];
let activeFolder = null; // Track currently selected folder for new words
let customFolders = []; // Store custom folder names
const itemsPerPage = 15; // Number of words per page
const currentPageByFolder = {}; // Object to track current page for each folder
let flashcardCurrentPage = 1; // Track current page for flashcard word selection
let quizCurrentPage = 1; // Track current page for quiz word selection

// Debug: indicate script loaded and current page
console.debug('[debug] script.js loaded', { pathname: window.location.pathname, host: window.location.host });

// Human-friendly POS labels used across the UI
const POS_LABELS = {
    noun: 'Съществително',
    verb: 'Глагол',
    adjective: 'Прилагателно',
    adverb: 'Наречие'
};

// Supabase mode performs auth guard after bridge initialization.

// Add at the top of script.js

// Add validation constants
const WORD_MAX_LENGTH = 50;
const DEFINITION_MAX_LENGTH = 500;

// Dictionary storage functions
function getUserDictionaryKey(userId) {
    return `dictionary_${userId}`;
}

function loadUserDictionary(userId) {
    // For guests, use a different storage key
    const key = localStorage.getItem('isGuest') ? 'dictionary_guest' : getUserDictionaryKey(userId);
    try {
        const savedWords = localStorage.getItem(key);
        if (savedWords) {
            words = JSON.parse(savedWords);
            // Migrate old words to add folder field
            let needsSave = false;
            words = words.map(word => {
                if (!word.folder) {
                    needsSave = true;
                    return {
                        ...word,
                        folder: getFolderFromDate(word.timestamp || Date.now())
                    };
                }
                return word;
            });
            if (needsSave) {
                localStorage.setItem(key, JSON.stringify(words));
            }
            // Initialize history with current state
            dictionaryHistory = [JSON.stringify(words)];
            currentHistoryIndex = 0;
        } else {
            words = [];
            dictionaryHistory = [JSON.stringify([])];
            currentHistoryIndex = 0;
        }
        updateWordList();
    } catch (error) {
        console.error('Error loading dictionary:', error);
        words = [];
        dictionaryHistory = [JSON.stringify([])];
        currentHistoryIndex = 0;
        showMessage('Грешка при зареждане на речника', 'red');
    }
}

function saveUserDictionary(userId) {
    // For guests, use a different storage key
    const key = localStorage.getItem('isGuest') ? 'dictionary_guest' : getUserDictionaryKey(userId);
    try {
        localStorage.setItem(key, JSON.stringify(words));
        return true;
    } catch (error) {
        console.error('Error saving dictionary:', error);
        showMessage('Грешка при запазване на речника', 'red');
        return false;
    }
}

// Initialize Google Sign-In
function initializeGoogleSignIn() {
    console.debug('[debug] initializeGoogleSignIn() called');
    if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleCredentialResponse
            });
            console.debug('[debug] google.accounts.id.initialize() OK');
            updateAuthUI();
        } catch (err) {
            console.error('[debug] google.accounts.id.initialize() failed', err);
        }
    } else {
        console.warn('[debug] Google Identity library not present yet, retrying');
        // If Google client isn't loaded yet, wait and try again
        setTimeout(initializeGoogleSignIn, 150);
    }
}

function showMessage(message, color) {
    const status = document.getElementById("status-message");
    if (!status) {
        console.warn('Status message element not found');
        return;
    }
    status.textContent = message;
    status.style.color = color;
    status.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (status) status.style.display = 'none';
    }, 3000);
}

function validateInput(word, definition) {
    if (!word || !definition) {
        showMessage('Моля, попълнете и думата, и определението!', 'red');
        return false;
    }
    
    if (word.length > WORD_MAX_LENGTH) {
        showMessage(`Думата трябва да е по-малко от ${WORD_MAX_LENGTH} символа!`, 'red');
        return false;
    }
    
    if (definition.length > DEFINITION_MAX_LENGTH) {
        showMessage(`Определението трябва да е по-малко от ${DEFINITION_MAX_LENGTH} символа!`, 'red');
        return false;
    }
    
    // Basic XSS prevention
    const sanitize = (str) => str.replace(/[<>]/g, '');
    return {
        word: sanitize(word),
        definition: sanitize(definition)
    };
}

function setLoading(element, isLoading) {
    if (isLoading) {
        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.innerHTML = '<span class="loading-spinner"></span> Зареждане...';
    } else {
        element.disabled = false;
        element.textContent = element.dataset.originalText;
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function generateQuestion(questionCount = 10, quizType = 'multiple', selectedWords = words) {
    const quizContainer = document.getElementById('quiz-container');
    const generateQuizButton = document.getElementById('generate-quiz');
    
    if (selectedWords.length < 4 && quizType !== 'reading') {
        showMessage('Добавете поне 4 думи в речника, за да започнете тест!', 'red');
        return;
    }

    setLoading(generateQuizButton, true);
    
    try {
        let modalOverlay = document.querySelector('.quiz-modal-overlay');
        if (!modalOverlay) {
            modalOverlay = document.createElement('div');
            modalOverlay.className = 'quiz-modal-overlay';
            document.body.appendChild(modalOverlay);
        }

        if (quizType === 'reading') {
            // --- Reading comprehension logic ---
            try {
                // Use only the words selected by the user for the reading passage
                const readingWords = selectedWords.map(w => w.word);

                const response = await fetch('http://127.0.0.1:8001/generate-reading-comprehension', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        words: readingWords,
                        language: "English",
                        questionCount: questionCount
                    })
                });

                if (!response.ok) throw new Error('AI service failed');
                const data = await response.json();
                if (!data.content) throw new Error('Invalid response format');

                // Parse the AI response
                const passageMatch = data.content.match(/Passage:\s*([\s\S]*?)\n\s*Questions:/i);
                const questionsMatch = data.content.match(/Questions:\s*([\s\S]*?)\n\s*Answers:/i);
                const answersMatch = data.content.match(/Answers:\s*([\s\S]*)$/i);

                const passage = passageMatch ? passageMatch[1].trim() : '';
                const questionsBlock = questionsMatch ? questionsMatch[1].trim() : '';
                const answersBlock = answersMatch ? answersMatch[1].trim() : '';
                const answerLines = answersBlock.split('\n').map(l => l.trim()).filter(Boolean);

                // Declare quizQuestions before use
                const quizQuestions = [];
                const questionRegex = /(\d+)\.\s*([^\n]+)\n\s*A\)\s*([^\n]+)\n\s*B\)\s*([^\n]+)\n\s*C\)\s*([^\n]+)(?:\n\s*D\)\s*([^\n]+))?/g;
                let match;
                while ((match = questionRegex.exec(questionsBlock)) !== null) {
                    quizQuestions.push({
                        question: match[2].trim(),
                        options: [match[3], match[4], match[5], match[6]].filter(Boolean)
                    });
                }

                const correctIndices = answerLines.map(line => {
                    const letter = line.split('.')[1]?.trim().toUpperCase() || '';
                    // Map A/B/C/D to 0/1/2/3
                    return ['A', 'B', 'C', 'D'].indexOf(letter);
                });

                // Render the quiz
                const quizHTML = `
                    <div class="quiz-modal">
                        <div class="quiz-progress">
                            <div class="quiz-progress-bar"></div>
                        </div>
                        <button class="quiz-close" onclick="quitQuiz()">×</button>
                        <div class="quiz-passage-panel">
                            <h2>Четене с разбиране</h2>
                            <div class="reading-passage">
                                <strong>Текст за четене:</strong>
                                <div class="passage-text">${passage.replace(/\n/g, '<br>')}</div>
                            </div>
                        </div>
                        <form class="quiz-form" id="quiz-form">
                            <div class="quiz-questions-wrapper">
                                <h3>Въпроси и отговори</h3>
                                ${quizQuestions.map((q, i) => `
                                    <div class="quiz-question-container" data-correct="${correctIndices[i]}">
                                        <h4>Въпрос ${i + 1}</h4>
                                        <p class="question-text">${q.question}</p>
                                        <div class="quiz-options">
                                            ${q.options.map((option, j) => `
                                                <label class="quiz-option" data-index="${j}">
                                                    <input type="radio" 
                                                           name="question${i}" 
                                                           id="q${i}option${j}" 
                                                           value="${j}"
                                                           required>
                                                    <span class="option-text">${option}</span>
                                                </label>
                                            `).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            <button type="submit" class="btn btn-primary">
                                Предай теста
                            </button>
                        </form>
                    </div>
                `;

                modalOverlay.innerHTML = quizHTML;
                modalOverlay.style.display = 'flex';

                // Add form submit handler
                const quizForm = document.getElementById('quiz-form');
                quizForm.addEventListener('submit', submitQuiz);

                // Progress bar logic
                const options = quizForm.querySelectorAll('.quiz-option');
                const progressBar = modalOverlay.querySelector('.quiz-progress-bar');
                options.forEach(option => {
                    option.addEventListener('click', () => {
                        const radio = option.querySelector('input[type="radio"]');
                        radio.checked = true;
                        const answered = quizForm.querySelectorAll('input[type="radio"]:checked').length;
                        const totalQuestions = quizQuestions.length;
                        const progress = (answered / totalQuestions) * 100;
                        progressBar.style.width = `${progress}%`;
                    });
                });

                return; // Don't run the rest of the function for reading quiz
            } catch (error) {
                showMessage('Грешка при генериране на теста за четене с разбиране.', 'red');
                console.error('Reading quiz generation error:', error);
                if (typeof modalOverlay !== 'undefined') modalOverlay.remove();
                setLoading(generateQuizButton, false);
                return;
            }
        }

        if (quizType === 'open') {
            // --- Open-ended test logic, styled like the single choice test ---
            const quizQuestions = [];
            const usedWords = new Set();
            const totalQuestions = Math.min(questionCount, selectedWords.length);

            for (let i = 0; i < totalQuestions; i++) {
                let questionWord;
                do {
                    questionWord = selectedWords[Math.floor(Math.random() * selectedWords.length)];
                } while (usedWords.has(questionWord.word));
                usedWords.add(questionWord.word);

                try {
                    const response = await fetch('http://127.0.0.1:8001/generate-open-clause', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            word: questionWord.word,
                            definition: questionWord.definition,
                            partOfSpeech: questionWord.partOfSpeech
                        })
                    });

                    if (!response.ok) throw new Error('AI service failed');
                    const data = await response.json();

                    if (!data.question || !data.answer) {
                        throw new Error('Invalid response format');
                    }

                    quizQuestions.push({
                        word: questionWord.word,
                        question: data.question,
                        correctAnswer: data.answer
                    });

                } catch (error) {
                    console.warn('AI open clause generation failed:', error);
                    quizQuestions.push({
                        word: questionWord.word,
                        question: `What ${questionWord.partOfSpeech} means: ${questionWord.definition}?`,
                        correctAnswer: questionWord.word
                    });
                }
            }

            // Render the open-ended quiz with the same structure as single choice
            const quizHTML = `
                <div class="quiz-modal">
                    <div class="quiz-progress">
                        <div class="quiz-progress-bar"></div>
                    </div>
                    <button class="quiz-close" onclick="quitQuiz()">×</button>
                    <form class="quiz-form" id="quiz-form">
                        <h2>Тест с отворени въпроси</h2>
                        <p class="quiz-instructions">
                            Въведете правилната дума за всяко описание:
                        </p>
                        ${quizQuestions.map((q, i) => `
                            <div class="quiz-question-container" data-correct="${q.correctAnswer}">
                                <h3>Въпрос ${i + 1}</h3>
                                <div class="open-question">
                                    <p class="question-text">${q.question}</p>
                                    <input type="text" 
                                           name="openQuestion${i}" 
                                           placeholder="Въведете думата тук" 
                                           required>
                                </div>
                            </div>
                        `).join('')}
                        <div class="quiz-controls">
                            <button type="submit" class="btn btn-primary">
                                Предай теста
                            </button>
                        </div>
                    </form>
                </div>
            `;

            modalOverlay.innerHTML = quizHTML;
            modalOverlay.style.display = 'flex';

            // Add form submit handler
            const quizForm = document.getElementById('quiz-form');
            quizForm.addEventListener('submit', submitQuiz);

            // Progress bar logic for open questions
            const inputs = quizForm.querySelectorAll('input[type="text"]');
            const progressBar = modalOverlay.querySelector('.quiz-progress-bar');
            inputs.forEach(input => {
                input.addEventListener('input', () => {
                    const answered = Array.from(inputs).filter(inp => inp.value.trim() !== '').length;
                    const totalQuestions = quizQuestions.length;
                    const progress = (answered / totalQuestions) * 100;
                    progressBar.style.width = `${progress}%`;
                });
            });

            return; // Don't run the rest of the function for open quiz
        }

        if (quizType === 'gap') {
            // --- Fill in the gap logic ---
            const quizQuestions = []; // Declare before use
            const usedWords = new Set();
            const totalQuestions = Math.min(questionCount, selectedWords.length);

            for (let i = 0; i < totalQuestions; i++) {
                let questionWord;
                do {
                    questionWord = selectedWords[Math.floor(Math.random() * selectedWords.length)];
                } while (usedWords.has(questionWord.word));
                usedWords.add(questionWord.word);

                try {
                    const response = await fetch('http://127.0.0.1:8001/generate-gap-fill', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            word: questionWord.word,
                            definition: questionWord.definition,
                            partOfSpeech: questionWord.partOfSpeech
                        })
                    });

                    if (!response.ok) throw new Error('AI service failed');
                    const data = await response.json();

                    if (!data.sentence || !data.answer) {
                        throw new Error('Invalid response format');
                    }

                    quizQuestions.push({
                        word: questionWord.word,
                        sentence: data.sentence,
                        correctAnswer: data.answer
                    });

                } catch (error) {
                    console.warn('AI gap fill generation failed:', error);
                    quizQuestions.push({
                        word: questionWord.word,
                        sentence: `____: ${questionWord.definition}`,
                        correctAnswer: questionWord.word
                    });
                }
            }

            // Render the gap-fill quiz
            const quizHTML = `
                <div class="quiz-modal">
                    <div class="quiz-progress">
                        <div class="quiz-progress-bar"></div>
                    </div>
                    <button class="quiz-close" onclick="quitQuiz()">×</button>
                    <form class="quiz-form" id="quiz-form">
                        <h2>Попълни празното място</h2>
                        <p class="quiz-instructions">
                            Въведете липсващата дума във всяко изречение:
                        </p>
                        ${quizQuestions.map((q, i) => `
                            <div class="quiz-question-container" data-correct="${q.correctAnswer}">
                                <h3>Въпрос ${i + 1}</h3>
                                <div class="open-question">
                                    <p class="question-text">${q.sentence.replace(/____/g, '<strong>____</strong>')}</p>
                                    <input type="text"
                                           name="gapQuestion${i}"
                                           placeholder="Въведете думата тук"
                                           required
                                           autocomplete="off"
                                           autocorrect="off"
                                           spellcheck="false">
                                </div>
                            </div>
                        `).join('')}
                        <div class="quiz-controls">
                            <button type="submit" class="btn btn-primary">
                                Предай теста
                            </button>
                        </div>
                    </form>
                </div>
            `;

            modalOverlay.innerHTML = quizHTML;
            modalOverlay.style.display = 'flex';

            // Add form submit handler
            const quizForm = document.getElementById('quiz-form');
            quizForm.addEventListener('submit', submitQuiz);

            // Progress bar logic for gap questions
            const inputs = quizForm.querySelectorAll('input[type="text"]');
            const progressBar = modalOverlay.querySelector('.quiz-progress-bar');
            inputs.forEach(input => {
                input.addEventListener('input', () => {
                    const answered = Array.from(inputs).filter(inp => inp.value.trim() !== '').length;
                    const totalQuestions = quizQuestions.length;
                    const progress = (answered / totalQuestions) * 100;
                    progressBar.style.width = `${progress}%`;
                });
            });

            return; // Don't run the rest of the function for gap quiz
        }

        if (quizType === 'gap-verb-form') {
            // --- Fill in the gap (verb form) logic ---
            const quizQuestions = []; // Declare before use
            const usedWords = new Set(); // Add this line to fix the reference error
            // Only verbs should be selected for this quiz type
            const verbWords = selectedWords.filter(w => w.partOfSpeech === 'verb');
            const totalQuestions = Math.min(questionCount, verbWords.length);

            for (let i = 0; i < totalQuestions; i++) {
                let questionWord;
                do {
                    questionWord = verbWords[Math.floor(Math.random() * verbWords.length)];
                } while (usedWords.has(questionWord.word));
                usedWords.add(questionWord.word);

                try {
                    const response = await fetch('http://127.0.0.1:8001/generate-gap-fill-verb-form', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            word: questionWord.word,
                            definition: questionWord.definition,
                            partOfSpeech: questionWord.partOfSpeech
                        })
                    });

                    if (!response.ok) throw new Error('AI service failed');
                    const data = await response.json();

                    if (!data.sentence || !data.answer) {
                        throw new Error('Invalid response format');
                    }

                    quizQuestions.push({
                        word: questionWord.word,
                        sentence: data.sentence,
                        correctAnswer: data.answer
                    });

                } catch (error) {
                    console.warn('AI gap fill verb form generation failed:', error);
                    quizQuestions.push({
                        word: questionWord.word,
                        sentence: `____: ${questionWord.definition}`,
                        correctAnswer: questionWord.word
                    });
                }
            }

            // Render the gap-fill verb form quiz
            const quizHTML = `
                <div class="quiz-modal">
                    <div class="quiz-progress">
                        <div class="quiz-progress-bar"></div>
                    </div>
                    <button class="quiz-close" onclick="quitQuiz()">×</button>
                    <form class="quiz-form" id="quiz-form">
                        <h2>Попълни глагола в правилната форма</h2>
                        <p class="quiz-instructions">
                            Въведете правилната форма на глагола във всяко изречение:
                        </p>
                        ${quizQuestions.map((q, i) => `
                            <div class="quiz-question-container" data-correct="${q.correctAnswer}">
                                <h3>Въпрос ${i + 1}</h3>
                                <div class="open-question">
                                    <p class="question-text">
                                        ${q.sentence.replace(/____/g, '<strong>____</strong>')}
                                        <br>
                                        <small class="verb-infinitive">(Инфинитив: <em>${q.word}</em>)</small>
                                    </p>
                                    <input type="text"
                                           name="gapVerbFormQuestion${i}"
                                           placeholder="Въведете формата на глагола"
                                           required
                                           autocomplete="off"
                                           autocorrect="off"
                                           spellcheck="false">
                                </div>
                            </div>
                        `).join('')}
                        <div class="quiz-controls">
                            <button type="submit" class="btn btn-primary">
                                Предай теста
                            </button>
                        </div>
                    </form>
                </div>
            `;

            modalOverlay.innerHTML = quizHTML;
            modalOverlay.style.display = 'flex';

            // Add form submit handler
            const quizForm = document.getElementById('quiz-form');
            quizForm.addEventListener('submit', submitQuiz);

            // Progress bar logic for gap questions
            const inputs = quizForm.querySelectorAll('input[type="text"]');
            const progressBar = modalOverlay.querySelector('.quiz-progress-bar');
            inputs.forEach(input => {
                input.addEventListener('input', () => {
                    const answered = Array.from(inputs).filter(inp => inp.value.trim() !== '').length;
                    const totalQuestions = quizQuestions.length;
                    const progress = (answered / totalQuestions) * 100;
                    progressBar.style.width = `${progress}%`;
                });
            });

            return; // Don't run the rest of the function for gap-verb-form quiz
        }

        // Multiple choice and fallback
        const quizQuestions = []; // Declare before use
        const usedWords = new Set();
        const totalQuestions = Math.min(questionCount, selectedWords.length);

        for (let i = 0; i < totalQuestions; i++) {
            let questionWord;
            do {
                questionWord = selectedWords[Math.floor(Math.random() * selectedWords.length)];
            } while (usedWords.has(questionWord.word));
            usedWords.add(questionWord.word);

            if (quizType === 'multiple') {
                try {
                    const response = await fetch('http://127.0.0.1:8001/generate-wrong-answers', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            word: questionWord.word,
                            definition: questionWord.definition,
                            partOfSpeech: questionWord.partOfSpeech
                        })
                    });

                    if (!response.ok) throw new Error('AI service failed');
                    
                    const data = await response.json();
                    
                    // Validate response format more thoroughly
                    if (!data || typeof data !== 'object') throw new Error('Invalid response format');
                    if (!data.correctAnswer || !Array.isArray(data.wrongAnswers) || data.wrongAnswers.length !== 3) {
                        throw new Error('Invalid answer format');
                    }

                    const answers = [data.correctAnswer, ...data.wrongAnswers];
                    const shuffledAnswers = shuffleArray([...answers]);
                    const correctIndex = shuffledAnswers.indexOf(data.correctAnswer);

                    quizQuestions.push({
                        word: questionWord.word,
                        answers: shuffledAnswers,
                        correctIndex: correctIndex
                    });

                } catch (error) {
                    console.warn('AI answer generation failed:', error);
                    // Use original definition and generic wrong answers as fallback
                    const genericAnswers = [
                        `Alternative meaning of "${questionWord.word}".`,
                        `Different definition of "${questionWord.word}".`,
                        `Another interpretation of "${questionWord.word}".`
                    ];
                    
                    const answers = [questionWord.definition, ...genericAnswers];
                    const shuffledAnswers = shuffleArray([...answers]);
                    const correctIndex = shuffledAnswers.indexOf(questionWord.definition);

                    quizQuestions.push({
                        word: questionWord.word,
                        answers: shuffledAnswers,
                        correctIndex: correctIndex
                    });
                }
            }
        }

        // Create quiz HTML
        const quizHTML = `
            <div class="quiz-modal">
                <div class="quiz-progress">
                    <div class="quiz-progress-bar"></div>
                </div>
                <button class="quiz-close" onclick="quitQuiz()">×</button>
                <form class="quiz-form" id="quiz-form">
                    <h2>Тест за проверка на знанията</h2>
                    <p class="quiz-instructions">
                        ${quizType === 'multiple' ? 
                          'Изберете правилното определение за всяка дума:' : 
                          'Въведете правилната дума за всяко определение:'}
                    </p>
                    
                    ${quizQuestions.map((q, i) => `
                        <div class="quiz-question-container" data-correct="${
                            quizType === 'multiple' ? q.correctIndex : q.correctAnswer
                        }">
                            <h3>Въпрос ${i + 1}</h3>
                            ${quizType === 'multiple' ? `
                                <p class="word-to-guess">Какво е определението на "<strong>${q.word}</strong>"?</p>
                                <div class="quiz-options">
                                    ${q.answers.map((answer, j) => `
                                        <label class="quiz-option" data-index="${j}">
                                            <input type="radio" 
                                                   name="question${i}" 
                                                   id="q${i}option${j}" 
                                                   value="${j}"
                                                   required>
                                            <span class="option-text">${answer}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            ` : `
                                <div class="open-question">
                                    <p class="question-text">${q.question}</p>
                                    <input type="text" 
                                           name="openQuestion${i}" 
                                           placeholder="Въведете думата тук" 
                                           required>
                                </div>
                            `}
                        </div>
                    `).join('')}
                    
                    <div class="quiz-controls">
                        <button type="submit" class="btn btn-primary">
                            Предай теста
                        </button>
                    </div>
                </form>
            </div>
        `;

        modalOverlay.innerHTML = quizHTML;
        modalOverlay.style.display = 'flex';

        // Add form submit handler
        const quizForm = document.getElementById('quiz-form');
        quizForm.addEventListener('submit', submitQuiz);

        // Update progress bar as user answers questions
        const options = quizForm.querySelectorAll('.quiz-option');
        const progressBar = modalOverlay.querySelector('.quiz-progress-bar');
        
        options.forEach(option => {
            option.addEventListener('click', () => {
                const radio = option.querySelector('input[type="radio"]');
                radio.checked = true;
                
                // Update progress bar with animation
                const answered = quizForm.querySelectorAll('input[type="radio"]:checked').length;
                const totalQuestions = quizQuestions.length;
                const progress = (answered / totalQuestions) * 100;
                progressBar.style.width = `${progress}%`;
            });
        });

    } catch (error) {
        showMessage('Грешка при генериране на теста. Моля, опитайте отново.', 'red');
        console.error('Quiz generation error:', error);
        // Fix: modalOverlay may not be defined if error occurs before its declaration
        let modalOverlay = document.querySelector('.quiz-modal-overlay');
        if (modalOverlay) modalOverlay.remove();
    } finally {
        setLoading(generateQuizButton, false);
    }
}

function quitQuiz(skipConfirmation = false) {
    if (skipConfirmation || confirm('Сигурни ли сте, че искате да прекратите теста? Вашият напредък ще бъде загубен.')) {
        const modalOverlay = document.querySelector('.quiz-modal-overlay');
        if (modalOverlay) {
            modalOverlay.style.opacity = '0';
            modalOverlay.style.transform = 'scale(0.95)';
            setTimeout(() => {
                modalOverlay.style.display = 'none';
                modalOverlay.style.opacity = '';
                modalOverlay.style.transform = '';
            }, 300);
        }
        if (!skipConfirmation) {
            showMessage('Тестът е прекратен', 'blue');
        }
    }
}

function submitQuiz(e) {
    e.preventDefault();
    
    const quizForm = document.getElementById('quiz-form');
    if (!quizForm || quizForm.dataset.submitted === 'true') return;
    
    quizForm.dataset.submitted = 'true';
    const questions = quizForm.querySelectorAll('.quiz-question-container');
    let correctAnswers = 0;
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
    }
    
    // Get selected words for quiz history considering both quiz types
    const selectedWords = Array.from(questions).map(question => {
        const wordElement = question.querySelector('.word-to-guess strong');
        if (wordElement) {
            // Multiple choice mode
            return words.find(w => w.word === wordElement.textContent);
        } else {
            // Open answer mode - use the correct answer from data attribute
            const correctAnswer = question.dataset.correct;
            return words.find(w => w.word === correctAnswer);
        }
    });
    
    questions.forEach((question, index) => {
        const isMultipleChoice = question.querySelector('.quiz-options') !== null;
        const isGapFill = question.querySelector('input[type="text"]') &&
                          question.querySelector('.open-question') &&
                          question.querySelector('.question-text') &&
                          question.querySelector('.question-text').innerHTML.includes('____');

        if (isMultipleChoice) {
            // Handle multiple choice questions
            const correctIndex = parseInt(question.dataset.correct);
            const selectedAnswer = question.querySelector('input[type="radio"]:checked');
            
            if (selectedAnswer) {
                const selectedIndex = parseInt(selectedAnswer.value);
                const optionElements = question.querySelectorAll('.quiz-option');
                
                setTimeout(() => {
                    optionElements.forEach(option => {
                        const optionIndex = parseInt(option.dataset.index);
                        if (optionIndex === correctIndex) {
                            option.classList.add('correct');
                        } else if (optionIndex === selectedIndex && selectedIndex !== correctIndex) {
                            option.classList.add('incorrect');
                        }
                    });
                }, index * 200);

                if (selectedIndex === correctIndex) {
                    correctAnswers++;
                }
            }
        } else if (isGapFill) {
            // Handle gap fill questions
            const correctAnswer = question.dataset.correct;
            const userAnswer = question.querySelector('input[type="text"]').value.trim().toLowerCase();
            const answerElement = question.querySelector('.open-question');

            setTimeout(() => {
                if (userAnswer === correctAnswer.toLowerCase()) {
                    answerElement.classList.add('correct');
                    correctAnswers++;
                } else {
                    answerElement.classList.add('incorrect');
                    // Show correct answer
                    const feedback = document.createElement('div');
                    feedback.className = 'answer-feedback';
                    feedback.textContent = `Правилен отговор: ${correctAnswer}`;
                    answerElement.appendChild(feedback);
                }
            }, index * 200);
        } else {
            // Handle open answer questions
            const correctAnswer = question.dataset.correct;
            const userAnswer = question.querySelector('input[type="text"]').value.trim().toLowerCase();
            const answerElement = question.querySelector('.open-question');
            
            setTimeout(() => {
                if (userAnswer === correctAnswer.toLowerCase()) {
                    answerElement.classList.add('correct');
                    correctAnswers++;
                } else {
                    answerElement.classList.add('incorrect');
                    // Show correct answer
                    const feedback = document.createElement('div');
                    feedback.className = 'answer-feedback';
                    feedback.textContent = `Правилен отговор: ${correctAnswer}`;
                    answerElement.appendChild(feedback);
                }
            }, index * 200);
        }
    });

    // Disable all inputs
    quizForm.querySelectorAll('input').forEach(input => input.disabled = true);
    
    // Show score with delay to allow for answer animations
    setTimeout(() => {
        const score = Math.round((correctAnswers / questions.length) * 100);
        const scoreHTML = `
            <div class="quiz-score">
                Резултат: ${correctAnswers}/${questions.length} (${score}%)
            </div>
            <div class="quiz-feedback">
                ${score >= 80 ? 'Отличен резултат! 🎉' : 
                  score >= 60 ? 'Добър резултат! 👍' : 
                  'Има още какво да научите! 📚'}
            </div>
            <button class="btn btn-primary" onclick="quitQuiz(true)">
                Затвори
            </button>
        `;
        
        const controls = quizForm.querySelector('.quiz-controls');
        if (controls) {
            controls.innerHTML = scoreHTML;
            saveQuizResult(correctAnswers, questions.length, selectedWords);
        }
    }, questions.length * 200 + 500);
}

function handleCredentialResponse(response) {
    console.debug('[debug] handleCredentialResponse called', { hasCredential: !!(response && response.credential) });
    try {
        if (!response || !response.credential) {
            console.warn('[debug] No credential present in response');
            showMessage('Няма получен токен от Google', 'red');
            return;
        }
        const data = jwt_decode(response.credential);
        console.debug('[debug] Decoded Google token', { sub: data.sub, email: data.email, name: data.name });
        // Store minimal user object
        const userObj = {
            sub: data.sub || data.email,
            name: data.name || data.email,
            email: data.email || null,
            picture: data.picture || null
        };
        sessionStorage.setItem('user', JSON.stringify(userObj));
        console.debug('[debug] User stored in sessionStorage', userObj);
        // Redirect to app page (app.html) or update UI if already there
        if (!window.location.pathname.includes('app.html')) {
            window.location.href = 'app.html';
        } else {
            updateAuthUI();
        }
    } catch (error) {
        console.error('[debug] handleCredentialResponse error', error);
        showMessage('Грешка при влизане', 'red');
    }
}

function updateAuthUI() {
    const user = JSON.parse(sessionStorage.getItem('user'));
    const authContainer = document.getElementById('google-signin-container');
    console.debug('[debug] updateAuthUI', { user, authContainerExists: !!authContainer });
    
    if (!authContainer) return;

    if (user) {
        const profilePicture = user.picture || '';
        const displayName = user.name || user.email || 'User';
        
        authContainer.innerHTML = `
            <div class="user-profile">
                <div class="user-avatar-container">
                    ${profilePicture ? 
                        `<img src="${profilePicture}" alt="${displayName}" class="user-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` :
                        `<div class="user-avatar-initial">${displayName[0].toUpperCase()}</div>`
                    }
                    <div class="user-avatar-initial" style="${profilePicture ? 'display: none;' : ''}">${displayName[0].toUpperCase()}</div>
                </div>
                <div class="user-info">
                    <p class="user-name">${displayName}</p>
                    <p class="user-email">${user.email || ''}</p>
                </div>
                <button class="sign-out">Изход</button>
            </div>
        `;
    } else {
        authContainer.innerHTML = '<div class="g_id_signin" data-type="standard"></div>';
        // Try to render the button if the GSI client is available
        if (window.google?.accounts?.id) {
            try {
                window.google.accounts.id.renderButton(authContainer, {
                    theme: 'filled_blue',
                    size: 'medium'
                });
                console.debug('[debug] GSI renderButton called');
            } catch (e) {
                console.warn('[debug] GSI renderButton failed', e);
            }
        }
    }
}

function signOut() {
    console.debug('[debug] signOut() called');
    const signOutBtn = document.querySelector('.sign-out');
    if (signOutBtn) setLoading(signOutBtn, true);
    
    const user = JSON.parse(sessionStorage.getItem('user'));
    
    if (!confirm('Сигурни ли сте, че искате да излезете?')) {
        if (signOutBtn) setLoading(signOutBtn, false);
        console.debug('[debug] signOut cancelled by user');
        return;
    }
    
    // Save dictionary before signing out
    if (user) {
        try {
            saveUserDictionary(user.sub);
        } catch (e) {
            console.warn('[debug] saveUserDictionary failed on signOut', e);
        }
    }
    
    sessionStorage.clear();
    words = [];
    updateWordList();
    
    if (window.google?.accounts?.id) {
        window.google.accounts.id.revoke(GOOGLE_CLIENT_ID, done => {
            console.debug('[debug] Google session revoked');
            window.location.href = 'index.html';
        });
    } else {
        window.location.href = 'index.html';
    }
    console.debug('[debug] signOut() completed');
}

function createWordElement(entry, posLabels) {
    const li = document.createElement('li');
    li.dataset.word = entry.word.toLowerCase();
    li.dataset.definition = entry.definition.toLowerCase();
    li.dataset.partOfSpeech = entry.partOfSpeech;
    
    li.innerHTML = `
        <div class="word-card">
            <a href="https://www.merriam-webster.com/dictionary/${encodeURIComponent(entry.word)}" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="word-card-link">
                <div class="word-header">
                    <div class="word-info">
                        <h3>${entry.word}</h3>
                        <span class="pos-label ${entry.partOfSpeech}">${posLabels[entry.partOfSpeech] || ''}</span>
                    </div>
                </div>
                <p class="definition">${entry.definition}</p>
            </a>
            <div class="word-actions">
                <button class="btn-move" aria-label="Премести ${entry.word}" title="Премести в друга папка">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 13H15L12 17L9 13Z" fill="currentColor"/>
                        <path d="M10 3H4C3.46957 3 2.96086 3.21071 2.58579 3.58579C2.21071 3.96086 2 4.46957 2 5V19C2 19.5304 2.21071 20.0391 2.58579 20.4142C2.96086 20.7893 3.46957 21 4 21H20C20.5304 21 21.0391 20.7893 21.4142 20.4142C21.7893 20.0391 22 19.5304 22 19V7C22 6.46957 21.7893 5.96086 21.4142 5.58579C21.0391 5.21071 20.5304 5 20 5H12L10 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="btn-edit" aria-label="Редактирай ${entry.word}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="btn-pronounce" onclick="speakWord('${entry.word}')" aria-label="Произнеси ${entry.word}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 12C17.0039 13.3308 16.4774 14.6024 15.54 15.54" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="btn-delete" aria-label="Изтрий ${entry.word}">×</button>
            </div>
        </div>
    `;
    return li;
}

// Update vocabulary statistics banner
function updateVocabStats() {
    const totalWordsEl = document.getElementById('total-words-count');
    const totalFoldersEl = document.getElementById('total-folders-count');
    const currentViewEl = document.getElementById('current-view-count');
    
    if (!totalWordsEl || !totalFoldersEl || !currentViewEl) return;
    
    // Total words
    totalWordsEl.textContent = words.length;
    
    // Total folders (including custom folders)
    const allFolders = getAllFolders();
    totalFoldersEl.textContent = allFolders.length;
    
    // Current view count (based on filters)
    const folderFilter = document.getElementById('folder-filter');
    const posFilter = document.getElementById('pos-filter');
    
    let filteredWords = [...words];
    
    // Apply folder filter
    if (folderFilter && folderFilter.value !== 'all') {
        filteredWords = filteredWords.filter(w => w.folder === folderFilter.value);
    }
    
    // Apply POS filter
    if (posFilter && posFilter.value !== 'any') {
        filteredWords = filteredWords.filter(w => w.partOfSpeech === posFilter.value);
    }
    
    currentViewEl.textContent = filteredWords.length;
}

function updateWordList() {
    const wordList = document.getElementById('word-list');
    if (!wordList) {
        // Element not present on this page (e.g., viewing index.html).
        // Silently skip updating the word list to avoid noisy console warnings.
        return;
    }
    
    // Update vocabulary stats banner
    updateVocabStats();
    
    const posFilter = document.getElementById('pos-filter');
    const sortBy = document.getElementById('sort-by');
    const folderFilter = document.getElementById('folder-filter');
    
    if (!posFilter || !sortBy) {
        console.warn('Filter elements not found');
        return;
    }
    
    wordList.innerHTML = '';
    
    if (words.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = '<p>Речникът е празен. Добавете някои думи, за да започнете!</p>';
        wordList.appendChild(emptyState);
        return;
    }

    // Update folder filter dropdown
    if (folderFilter) {
        const currentFolder = folderFilter.value;
        folderFilter.innerHTML = '<option value="all">Всички папки</option>';
        getAllFolders().forEach(folder => {
            const option = document.createElement('option');
            option.value = folder;
            option.textContent = folder;
            folderFilter.appendChild(option);
        });
        folderFilter.value = currentFolder;
    }

    // Add event listeners for filters if they don't exist
    if (!posFilter.dataset.hasListener) {
        posFilter.addEventListener('change', () => {
            // Reset pagination when POS filter changes
            for (let folder in currentPageByFolder) {
                currentPageByFolder[folder] = 1;
            }
            updateWordList();
        });
        posFilter.dataset.hasListener = 'true';
    }
    
    if (!sortBy.dataset.hasListener) {
        sortBy.addEventListener('change', () => {
            // Reset pagination when sort changes
            for (let folder in currentPageByFolder) {
                currentPageByFolder[folder] = 1;
            }
            updateWordList();
        });
        sortBy.dataset.hasListener = 'true';
    }

    if (folderFilter && !folderFilter.dataset.hasListener) {
        folderFilter.addEventListener('change', () => {
            // Reset pagination when folder changes
            for (let folder in currentPageByFolder) {
                currentPageByFolder[folder] = 1;
            }
            // Set active folder when dropdown changes
            activeFolder = folderFilter.value === 'all' ? null : folderFilter.value;
            updateWordList();
        });
        folderFilter.dataset.hasListener = 'true';
    }

    // New folder button listener
    const newFolderBtn = document.getElementById('new-folder-btn');
    if (newFolderBtn && !newFolderBtn.dataset.hasListener) {
        newFolderBtn.addEventListener('click', createNewFolder);
        newFolderBtn.dataset.hasListener = 'true';
    }

    // Filter words by part of speech
    let filteredWords = [...words];
    if (posFilter.value !== 'any') {
        filteredWords = filteredWords.filter(entry => entry.partOfSpeech === posFilter.value);
    }

    // Filter by folder
    if (folderFilter && folderFilter.value !== 'all') {
        filteredWords = filteredWords.filter(entry => {
            const wordFolder = entry.folder || getFolderFromDate(entry.timestamp);
            return wordFolder === folderFilter.value;
        });
    }

    // Sort the filtered words
    filteredWords.sort((a, b) => {
        switch (sortBy.value) {
            case 'newest':
                return (b.timestamp || 0) - (a.timestamp || 0);
            case 'oldest':
                return (a.timestamp || 0) - (b.timestamp || 0);
            case 'az':
                return a.word.localeCompare(b.word, 'bg');
            case 'za':
                return b.word.localeCompare(a.word, 'bg');
            default:
                return 0;
        }
    });

    const posLabels = {
        'noun': 'Съществително име',
        'verb': 'Глагол',
        'adjective': 'Прилагателно име',
        'adverb': 'Наречие'
    };

    // Show message if no words match the filter
    if (filteredWords.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `<p>Няма думи от тип "${posFilter.options[posFilter.selectedIndex].text}"</p>`;
        wordList.appendChild(emptyState);
        return;
    }

    // Group words by folder
    const wordsByFolder = {};
    filteredWords.forEach(entry => {
        const folder = entry.folder || getFolderFromDate(entry.timestamp);
        if (!wordsByFolder[folder]) {
            wordsByFolder[folder] = [];
        }
        wordsByFolder[folder].push(entry);
    });

    // Add empty custom folders that might not have words yet
    customFolders.forEach(folder => {
        if (!wordsByFolder[folder]) {
            wordsByFolder[folder] = [];
        }
    });

    // Create folder sections
    const folderNames = Object.keys(wordsByFolder).sort().reverse(); // Most recent first
    folderNames.forEach((folderName, index) => {
        // Create folder header
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        
        // Set first folder as active if no active folder is set
        if (index === 0 && !activeFolder) {
            folderHeader.classList.add('active');
            activeFolder = folderName;
        } else if (activeFolder === folderName) {
            folderHeader.classList.add('active');
        }
        
        folderHeader.innerHTML = `
            <span class="folder-icon">📁</span>
            <span class="folder-name">${folderName}</span>
            <span class="folder-count">(${wordsByFolder[folderName].length})</span>
            <span class="folder-toggle">▼</span>
        `;
        
        // Create folder content
        const folderContent = document.createElement('div');
        folderContent.className = 'folder-content';
        
        // Initialize current page for this folder if not set
        if (!currentPageByFolder[folderName]) {
            currentPageByFolder[folderName] = 1;
        }
        
        const folderWords = wordsByFolder[folderName];
        const totalPages = Math.ceil(folderWords.length / itemsPerPage);
        const currentPage = currentPageByFolder[folderName];
        const startIdx = (currentPage - 1) * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const pageWords = folderWords.slice(startIdx, endIdx);
        
        // Add words for current page
        pageWords.forEach(entry => {
            const wordElement = createWordElement(entry, posLabels);
            folderContent.appendChild(wordElement);
        });
        
        // Add pagination controls if there are multiple pages
        if (totalPages > 1) {
            const paginationDiv = document.createElement('div');
            paginationDiv.className = 'pagination-controls';
            paginationDiv.innerHTML = `
                <button type="button" class="pagination-btn pagination-prev" ${currentPage === 1 ? 'disabled' : ''}>
                    ‹ Предишна
                </button>
                <span class="pagination-info">Страница <span class="current-page">${currentPage}</span> от <span class="total-pages">${totalPages}</span></span>
                <button type="button" class="pagination-btn pagination-next" ${currentPage === totalPages ? 'disabled' : ''}>
                    Следваща ›
                </button>
            `;
            folderContent.appendChild(paginationDiv);
            
            // Add event listeners for pagination buttons
            const prevBtn = paginationDiv.querySelector('.pagination-prev');
            const nextBtn = paginationDiv.querySelector('.pagination-next');
            
            if (prevBtn && nextBtn) {
                prevBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (currentPageByFolder[folderName] > 1) {
                        currentPageByFolder[folderName]--;
                        updateWordList();
                    }
                });
                
                nextBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (currentPageByFolder[folderName] < totalPages) {
                        currentPageByFolder[folderName]++;
                        updateWordList();
                    }
                });
            }
        }
        
        // Toggle folder on click
        folderHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Folder clicked:', folderName);
            
            // Toggle collapse state
            
            // Toggle collapse state
            const wasCollapsed = folderContent.classList.contains('collapsed');
            console.log('Was collapsed:', wasCollapsed);
            
            folderContent.classList.toggle('collapsed');
            folderHeader.classList.toggle('collapsed');
            const toggle = folderHeader.querySelector('.folder-toggle');
            toggle.textContent = folderContent.classList.contains('collapsed') ? '▶' : '▼';
            
            console.log('Now collapsed:', folderContent.classList.contains('collapsed'));
            
            // Set as active folder for new words when expanding
            if (wasCollapsed) {
                // Remove active from all folders
                document.querySelectorAll('.folder-header').forEach(fh => {
                    fh.classList.remove('active');
                });
                // Set this folder as active
                folderHeader.classList.add('active');
                activeFolder = folderName;
                console.log('Active folder set to:', activeFolder);
            }
        });
        
        wordList.appendChild(folderHeader);
        wordList.appendChild(folderContent);
    });

    // Create and append word elements
    // filteredWords.forEach((entry) => {
    //     const wordElement = createWordElement(entry, posLabels);
    //     wordList.appendChild(wordElement);
    // });
    // Keep flashcard word list in sync whenever word list is updated
    try {
        if (typeof updateFlashcardWordList === 'function') updateFlashcardWordList();
    } catch (err) {
        console.warn('Failed to update flashcard word list:', err);
    }
}

// Helper function to get folder name from date
function getFolderFromDate(timestamp) {
    const date = new Date(timestamp || Date.now());
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Get all unique folders from words
function getAllFolders() {
    const folders = new Set(words.map(w => w.folder || getFolderFromDate(w.timestamp)));
    // Add custom folders even if they have no words yet
    customFolders.forEach(f => folders.add(f));
    return Array.from(folders).sort().reverse(); // Most recent first
}

function createNewFolder() {
    const folderName = prompt('Въведете име на новата папка:');
    
    if (!folderName) return; // User cancelled
    
    const trimmed = folderName.trim();
    if (trimmed.length === 0) {
        showMessage('Името на папката не може да е празно!', 'red');
        return;
    }
    
    if (trimmed.length > 50) {
        showMessage('Името на папката е твърде дълго! (макс. 50 символа)', 'red');
        return;
    }
    
    // Check if folder already exists
    const allFolders = getAllFolders();
    if (allFolders.includes(trimmed)) {
        showMessage('Папка с това име вече съществува!', 'red');
        return;
    }
    
    // Add to custom folders
    customFolders.push(trimmed);
    
    // Set as active folder
    activeFolder = trimmed;
    
    // Save custom folders to localStorage
    saveCustomFolders();
    
    // Update folder dropdown and select the new folder
    const folderFilter = document.getElementById('folder-filter');
    if (folderFilter) {
        folderFilter.value = trimmed;
    }
    
    // Update word list to show the new folder
    updateWordList();
    
    showMessage(`Папка "${trimmed}" е създадена успешно!`, 'green');
}

function saveCustomFolders() {
    const user = JSON.parse(sessionStorage.getItem('user'));
    const key = user ? `customFolders_${user.sub}` : 'customFolders_guest';
    localStorage.setItem(key, JSON.stringify(customFolders));
}

function loadCustomFolders() {
    const user = JSON.parse(sessionStorage.getItem('user'));
    const key = user ? `customFolders_${user.sub}` : 'customFolders_guest';
    const stored = localStorage.getItem(key);
    if (stored) {
        customFolders = JSON.parse(stored);
    }
}

function addWord(word, definition) {
    const validated = validateInput(word, definition);
    if (!validated) return false;

    const exists = words.some(entry => entry.word.toLowerCase() === validated.word.toLowerCase());

    if (!exists) {
        const partOfSpeech = document.getElementById('partOfSpeech').value;
        if (!partOfSpeech) {
            showMessage('Моля, изберете част на речта!', 'red');
            return false;
        }
        
        const newWords = [...words, {
            word: validated.word,
            definition: validated.definition,
            partOfSpeech: partOfSpeech,
            timestamp: Date.now(), // Add timestamp for sorting
            folder: activeFolder || getFolderFromDate(Date.now()) // Use active folder if set, otherwise use date
        }];
        
        saveToHistory(newWords);
        words = newWords;

        try {
            const user = JSON.parse(sessionStorage.getItem('user'));
            if (user) {
                if (!saveUserDictionary(user.sub)) {
                    words.pop(); // rollback
                    throw new Error('Failed to save dictionary');
                }
            } else {
                localStorage.setItem('dictionary', JSON.stringify(words));
            }

            updateWordList();
            showMessage(`"${validated.word}" е добавена успешно!`, 'green');
            return true;
        } catch (error) {
            console.error('Error saving word:', error);
            if (error.name === 'QuotaExceededError') {
                showMessage('Паметта е пълна! Моля, изтрийте някои думи първо.', 'red');
            } else {
                showMessage('Грешка при запазване. Моля, опитайте отново.', 'red');
            }
            return false;
        }
    } else {
        showMessage(`"${validated.word}" вече съществува в речника!`, 'red');
        return false;
    }
}

function editWord(word) {
    const wordEntry = words.find(entry => entry.word === word);
    if (!wordEntry) return;

    // Fill the form with existing values
    document.getElementById('word').value = wordEntry.word;
    document.getElementById('definition').value = wordEntry.definition;
    document.getElementById('partOfSpeech').value = wordEntry.partOfSpeech;

    // Remove the word temporarily
    words = words.filter(entry => entry.word !== word);
    updateWordList();

    // Switch to dictionary view and focus on word input
    switchView('dictionary');
    document.getElementById('word').focus();

    showMessage('Редактирайте думата и натиснете "Добави дума"', 'blue');
}

function filterWords(searchTerm) {
    const wordList = document.getElementById('word-list');
    const searchTermLower = searchTerm.toLowerCase();
    const items = wordList.getElementsByTagName('li');
    let hasVisibleItems = false;
    
    Array.from(items).forEach((li) => {
        const word = li.dataset.word;
        const definition = li.dataset.definition;
        const isMatch = word.includes(searchTermLower) || definition.includes(searchTermLower);
        
        li.style.display = isMatch ? 'block' : 'none';
        if (isMatch) hasVisibleItems = true;
    });
    
    // Show no results message if nothing matches
    const existingNoResults = wordList.querySelector('.no-results');
    if (!hasVisibleItems) {
        if (!existingNoResults) {
            const noResults = document.createElement('div');
            noResults.className = 'empty-state no-results';
            noResults.innerHTML = `<p>No words found matching "${searchTerm}"</p>`;
            wordList.appendChild(noResults);
        }
    } else if (existingNoResults) {
        existingNoResults.remove();
    }
}

function switchView(viewId) {
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.view === viewId);
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.toggle('active', view.id === `view-${viewId}`);
    });

    // Update quiz history when switching to quiz view
    if (viewId === 'quiz') {
        updateQuizHistory();
    }

    // Update flashcard word list when switching to flashcards view
    if (viewId === 'flashcards') {
        updateFlashcardWordList();
    }

    // Save current view to session storage
    sessionStorage.setItem('currentView', viewId);
}

// Initialize the entire application
function initializeApp() {
    const wordList = document.getElementById('word-list');
    const posFilter = document.getElementById('pos-filter');
    const sortBy = document.getElementById('sort-by');

    // Only initialize if on app.html (where these elements exist)
    if (!wordList || !posFilter || !sortBy) {
        console.warn('App initialization skipped - not on app.html');
        return;
    }

    // Load appropriate dictionary
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (user) {
        loadUserDictionary(user.sub);
    } else {
        // For guests, always start with an empty dictionary
        words = [];
        localStorage.removeItem('dictionary');
    }

    // Initialize word list
    updateWordList();
}

// Global error capture helpers so errors are available after a reload
window.addEventListener('error', (ev) => {
    try {
        const payload = {
            message: ev.message,
            filename: ev.filename,
            lineno: ev.lineno,
            colno: ev.colno,
            stack: ev.error ? (ev.error.stack || null) : null,
            timestamp: Date.now()
        };
        sessionStorage.setItem('lastError', JSON.stringify(payload));
        console.debug('[debug] captured window.error to sessionStorage.lastError', payload);
    } catch (e) {}
});

window.addEventListener('unhandledrejection', (ev) => {
    try {
        const payload = {
            reason: ev.reason && (ev.reason.message || String(ev.reason)),
            stack: ev.reason && ev.reason.stack || null,
            timestamp: Date.now()
        };
        sessionStorage.setItem('lastRejection', JSON.stringify(payload));
        console.debug('[debug] captured unhandledrejection to sessionStorage.lastRejection', payload);
    } catch (e) {}
});

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the app only when on the main application page
    if (window.location.pathname.includes('app.html')) {
        initializeApp();
    }
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.id = 'word-search';
    searchInput.className = 'search-input';
    searchInput.placeholder = 'Търси думи...';
    searchInput.setAttribute('aria-label', 'Търси думи');
    
    // Update dictionary controls HTML
    const dictionaryControls = document.createElement('div');
    dictionaryControls.className = 'dictionary-controls';
    dictionaryControls.innerHTML = `
        <div class="history-controls">
            <button id="undo-btn" class="btn btn-secondary" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 7v6h6"></path>
                    <path d="M3 13c0-4.97 4.03-9 9-9a9 9 0 0 1 9 9 9 9 0 0 1-9 9 9 9 0 0 1-6-2.3"></path>
                </svg>
                Отмени
            </button>
            <button id="redo-btn" class="btn btn-secondary" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 7v6h-6"></path>
                    <path d="M21 13c0-4.97-4.03-9-9-9a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 6-2.3"></path>
                </svg>
                Повтори
            </button>
        </div>
        <button id="export-btn" class="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Изтегли речника
        </button>
    `;
    // Add POS legend to the controls for quick reference
    const posLegend = document.createElement('div');
    posLegend.className = 'pos-legend';
    posLegend.innerHTML = `
        <div class="pos-legend-item"><span class="pos-dot noun"></span> ${POS_LABELS.noun}</div>
        <div class="pos-legend-item"><span class="pos-dot verb"></span> ${POS_LABELS.verb}</div>
        <div class="pos-legend-item"><span class="pos-dot adjective"></span> ${POS_LABELS.adjective}</div>
        <div class="pos-legend-item"><span class="pos-dot adverb"></span> ${POS_LABELS.adverb}</div>
    `;
    dictionaryControls.appendChild(posLegend);
    
    const dictionarySection = document.getElementById('dictionary');
    if (dictionarySection) {
        dictionarySection.insertBefore(dictionaryControls, dictionarySection.firstChild);
        
        // Create a control group wrapper for search input
        const searchControlGroup = document.createElement('div');
        searchControlGroup.className = 'control-group';
        const searchLabel = document.createElement('label');
        searchLabel.htmlFor = 'word-search';
        searchLabel.textContent = 'Търси думи';
        searchControlGroup.appendChild(searchLabel);
        searchControlGroup.appendChild(searchInput);
        
        dictionarySection.insertBefore(searchControlGroup, dictionarySection.querySelector('#word-list'));
        
        searchInput.addEventListener('input', (e) => {
            filterWords(e.target.value);
        });
        
        // Add undo button click handler
        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) {
            undoBtn.addEventListener('click', undo);
        }
        
        const redoBtn = document.getElementById('redo-btn');
        if (redoBtn) {
            redoBtn.addEventListener('click', redo);
        }
    }
    
    // Initialize quiz history
    updateQuizHistory();
    
    // Load appropriate dictionary
    const user = JSON.parse(sessionStorage.getItem('user'));
    const isGuest = localStorage.getItem('isGuest');
    
    if (user) {
        loadCustomFolders(); // Load custom folders first
        loadUserDictionary(user.sub);
    } else if (isGuest) {
        loadCustomFolders(); // Load custom folders first
        // Load guest dictionary
        const guestData = localStorage.getItem('dictionary_guest');
        if (guestData) {
            words = JSON.parse(guestData);
        } else {
            words = [];
        }
        updateWordList();
    } else {
        // Should not happen, but handle it gracefully
        words = [];
    }
    
    // Only initialize Google Sign-In on the landing page
    if (!window.location.pathname.includes('app.html')) {
        initializeGoogleSignIn();
    } else {
        // On app.html, just update the UI if user is logged in
        updateAuthUI();
    }
    
    // Redirect if not authenticated (allow guests)
    if (false && window.location.pathname.includes('app.html') && !sessionStorage.getItem('user') && !localStorage.getItem('isGuest')) {
        console.debug('[debug] would redirect to index.html: no session user and not a guest — showing hold overlay so you can copy errors');

        // Create a small overlay that prevents immediate navigation so the developer can copy console errors
        try {
            const holdOverlay = document.createElement('div');
            holdOverlay.id = 'auth-hold-overlay';
            holdOverlay.style.position = 'fixed';
            holdOverlay.style.inset = '12px';
            holdOverlay.style.zIndex = 99999;
            holdOverlay.style.background = 'rgba(0,0,0,0.6)';
            holdOverlay.style.color = '#fff';
            holdOverlay.style.display = 'flex';
            holdOverlay.style.flexDirection = 'column';
            holdOverlay.style.alignItems = 'center';
            holdOverlay.style.justifyContent = 'center';
            holdOverlay.style.padding = '20px';
            holdOverlay.style.borderRadius = '8px';
            // Enhanced overlay with last-error display and copy/download helpers
            holdOverlay.innerHTML = `
                <div style="max-width:920px;text-align:left;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <h2 style="margin:0 0 8px;color:#fff;">Не сте влезли в системата</h2>
                            <p style="margin:0 0 12px;color:#ddd;">За да видите страницата трябва да влезете. Можете да копирате последните грешки отдолу преди да продължите.</p>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button id="auth-hold-proceed" style="padding:8px 12px;border-radius:6px;border:0;background:#4361ee;color:#fff;cursor:pointer;">Отиди на вход</button>
                            <button id="auth-hold-guest" style="padding:8px 12px;border-radius:6px;border:0;background:#6c757d;color:#fff;cursor:pointer;">Продължи като гост</button>
                        </div>
                    </div>
                    <div style="margin-top:12px;color:#fff;">
                        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                            <button id="auth-copy-errors" style="padding:6px 10px;border-radius:6px;border:0;background:#00aaff;color:#fff;cursor:pointer;">Копирай грешките</button>
                            <button id="auth-download-errors" style="padding:6px 10px;border-radius:6px;border:0;background:#22bb66;color:#fff;cursor:pointer;">Изтегли лог (.json)</button>
                            <span style="opacity:0.9;font-size:12px">(последна runtime грешка и unhandled rejection)</span>
                        </div>
                        <textarea id="auth-last-errors" readonly style="width:100%;height:220px;padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.4);color:#fff;font-family:monospace;resize:vertical;"></textarea>
                        <p style="margin-top:8px;font-size:12px;opacity:0.9;color:#ccc">Tip: enable 'Preserve log' in DevTools → Console/Network to keep logs across navigation.</p>
                    </div>
                </div>
            `;

            document.body.appendChild(holdOverlay);

            // Populate last errors if any
            try {
                const lastErr = sessionStorage.getItem('lastError');
                const lastRej = sessionStorage.getItem('lastRejection');
                const display = document.getElementById('auth-last-errors');
                const combined = {
                    lastError: lastErr ? JSON.parse(lastErr) : null,
                    lastRejection: lastRej ? JSON.parse(lastRej) : null,
                    now: new Date().toISOString()
                };
                display.value = JSON.stringify(combined, null, 2);
            } catch (e) {
                console.warn('[debug] failed to populate last errors', e);
            }

            // Copy and download handlers
            document.getElementById('auth-copy-errors').addEventListener('click', async () => {
                try {
                    const txt = document.getElementById('auth-last-errors').value;
                    await navigator.clipboard.writeText(txt);
                    alert('Грешките са копирани в клипборда');
                } catch (e) {
                    console.warn('[debug] clipboard copy failed', e);
                    alert('Неуспешно копиране — вижте конзолата');
                }
            });

            document.getElementById('auth-download-errors').addEventListener('click', () => {
                const txt = document.getElementById('auth-last-errors').value;
                const blob = new Blob([txt], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `last-errors-${new Date().toISOString()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            });

            document.getElementById('auth-hold-proceed').addEventListener('click', () => {
                window.location.href = 'index.html';
            });
            document.getElementById('auth-hold-guest').addEventListener('click', () => {
                localStorage.setItem('isGuest', 'true');
                // Remove overlay and initialize app as guest
                holdOverlay.remove();
                initializeApp();
            });
        } catch (e) {
            console.warn('[debug] failed to show hold overlay, redirecting', e);
            window.location.href = 'index.html';
        }
    }
    
    // Initialize form submission
    const wordForm = document.getElementById('word-form');
    if (wordForm) {
        wordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const word = document.getElementById('word').value.trim();
            const definition = document.getElementById('definition').value.trim();

            if (word && definition) {
                addWord(word, definition);
                updateWordList();
                wordForm.reset();
            }
        });
    }
    
    // Initialize quiz
    const quizContainer = document.getElementById('quiz-container');
    const generateQuizButton = document.getElementById('generate-quiz');
    if (generateQuizButton) {
        generateQuizButton.addEventListener('click', showQuizConfig);
    }
    
    // Initial word list update
    updateWordList();
    
    // Handle sign-out button clicks
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('sign-out')) {
            e.preventDefault();
            signOut();
        }
    });
    
    // Add error handling for Google Sign-In
    window.addEventListener('error', (event) => {
        if (event.filename?.includes('accounts.google.com')) {
            showMessage('Грешка при зареждане на Google вход. Моля, презаредете страницата.', 'red');
        }
    });

    // Add view switching handlers
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            switchView(link.dataset.view);
        });
    });

    // Restore last active view
    const lastView = sessionStorage.getItem('currentView') || 'dictionary';
    switchView(lastView);

    // Chat functionality (only initialize on app.html)
    if (window.location.pathname.includes('app.html')) {
        const chatTrigger = document.querySelector('.chat-trigger');
        const chatOverlay = document.querySelector('.chat-overlay');
        const chatClose = document.querySelector('.chat-close');
        const chatInput = document.querySelector('.chat-input textarea');
        const sendButton = document.querySelector('.send-message');
        const chatMessages = document.querySelector('.chat-messages');
        
        // Check if chat elements exist; if not, quietly skip chat setup
        if (!chatTrigger || !chatOverlay || !chatClose || !chatInput || !sendButton || !chatMessages) {
            // Chat not present on this page; do nothing
        } else {

    function toggleChat() {
        chatOverlay.classList.toggle('active');
        if (chatOverlay.classList.contains('active')) {
            chatInput.focus();
        }
    }

    function addMessage(content, isUser = false) {
        const message = document.createElement('div');
        message.className = `message ${isUser ? 'user' : 'assistant'}`;
        message.innerHTML = `
            <div class="message-content">${content}</div>
        `;
        chatMessages.appendChild(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return message;
    }

    async function handleSendMessage() {
        const content = chatInput.value.trim();
        console.debug('[debug] handleSendMessage called', { preview: content ? content.slice(0,120) : null, wordsCount: words.length });
        if (content) {
            addMessage(content, true);  // Display user's message
            chatInput.value = '';
            chatInput.style.height = 'auto';

            const loadingMessage = addMessage('Мисля...', false);

            try {
                const wordsWithStringTimestamps = words.map(word => ({
                    ...word,
                    timestamp: word.timestamp ? String(word.timestamp) : null
                }));

                const response = await fetch('http://127.0.0.1:8001/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        message: content,
                        words: wordsWithStringTimestamps
                    })
                });

                const data = await response.json();
                loadingMessage.remove();

                if (data.error) {
                    addMessage('Съжалявам, възникна грешка: ' + data.error, false);
                    return;
                }

                if (data.response) {
                    addMessage(data.response, false);
                } else {
                    addMessage('Няма отговор от сървъра.', false);
                }

            } catch (error) {
                loadingMessage.remove();
                addMessage('Съжалявам, възникна грешка при комуникацията със сървъра.', false);
                console.error('Chat error:', error);
            }
        }
    }
    
    
        // Auto-resize textarea as the user types
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = chatInput.scrollHeight + 'px';
        });
        
        // Event listeners
        chatTrigger.addEventListener('click', toggleChat);
        chatClose.addEventListener('click', toggleChat);
        
        sendButton.addEventListener('click', handleSendMessage);
        
        // Send message on Enter keypress (without shift)
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
        

        // Close chat when clicking outside
        document.addEventListener('click', (e) => {
            if (chatOverlay.classList.contains('active') &&
                !chatOverlay.contains(e.target) &&
                !chatTrigger.contains(e.target)) {
                toggleChat();
            }
        });
        }
    }

    // Initialize flashcards
    const startFlashcardsButton = document.getElementById('generate-flashcards');
    if (startFlashcardsButton) {
        startFlashcardsButton.addEventListener('click', startFlashcards);
        updateFlashcardWordList(); // Initialize the word list
    }

    // Initialize word selection controls for flashcards
    const selectAllFlashcards = document.getElementById('select-all-flashcards');
    const deselectAllFlashcards = document.getElementById('deselect-all-flashcards');
    const flashcardSearch = document.getElementById('flashcard-search');
    
    if (selectAllFlashcards && deselectAllFlashcards) {
        selectAllFlashcards.addEventListener('click', () => {
            document.querySelectorAll('#flashcard-words input[type="checkbox"]:not([style*="display: none"])')
                .forEach(cb => cb.checked = true);
        });
        
        deselectAllFlashcards.addEventListener('click', () => {
            document.querySelectorAll('#flashcard-words input[type="checkbox"]:not([style*="display: none"])')
                .forEach(cb => cb.checked = false);
        });
    }

    // Flashcard search functionality
    if (flashcardSearch) {
        flashcardSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const wordLabels = document.querySelectorAll('#flashcard-words .word-checkbox');
            
            wordLabels.forEach(label => {
                const wordText = label.querySelector('span').textContent.toLowerCase();
                const matches = wordText.includes(searchTerm);
                label.style.display = matches ? '' : 'none';
            });
        });
    }

    // File selection handling
    const fileInput = document.getElementById('file-input');
    const fileSelectBtn = document.getElementById('file-select-btn');
    const fileNameDisplay = document.getElementById('file-name');
    
    if (fileSelectBtn && fileInput) {
        fileSelectBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                fileNameDisplay.textContent = file.name;
                
                const formData = new FormData();
                formData.append('file', file);

                try {
                    const response = await fetch('http://127.0.0.1:8001/structure-words', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) throw new Error("Failed to process file");

                    const cleanedText = await response.text();
                    const lines = cleanedText.split('\n');
                    const originalWords = [...words]; // Store original state
                    let addedCount = 0;

                    lines.forEach(line => {
                        if (!line.trim()) return;

                        const [word, definition, partOfSpeech] = line.split(',').map(str => str.trim());
                        if (word && definition && partOfSpeech) {
                            if (['noun', 'verb', 'adjective', 'adverb'].includes(partOfSpeech)) {
                                const timestamp = Date.now();
                                words.push({
                                    word: word,
                                    definition: definition,
                                    partOfSpeech: partOfSpeech,
                                    timestamp: timestamp,
                                    folder: getFolderFromDate(timestamp)
                                });
                                addedCount++;
                            } else {
                                console.warn(`Skipping word "${word}": Invalid part of speech "${partOfSpeech}"`);
                            }
                        }
                    });

                    if (addedCount > 0) {
                        // Save the entire batch as one history state
                        saveToHistory(words);
                        
                        const user = JSON.parse(sessionStorage.getItem('user'));
                        if (user) {
                            saveUserDictionary(user.sub);
                        } else {
                            localStorage.setItem('dictionary', JSON.stringify(words));
                        }

                        updateWordList();
                        showMessage(`Успешно добавени ${addedCount} думи от файла`, 'green');
                    }
                    
                    fileInput.value = '';
                    fileNameDisplay.textContent = 'Няма избран файл';

                } catch (error) {
                    showMessage('Грешка при обработка на файла от сървъра.', 'red');
                    console.error('Upload or parsing error:', error);
                }
            }
        });
    }

    // Add export button handler
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', showExportModal);
    }

    // Back to top functionality
    const backToTop = document.getElementById('back-to-top');
    
    if (backToTop) {
        function handleScroll() {
            if (window.scrollY > 200) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        }

        window.addEventListener('scroll', handleScroll);
        
        backToTop.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-delete')) {
        const wordElement = e.target.closest('.word-card').querySelector('h3');
        const word = wordElement.textContent;
        const newWords = words.filter(entry => entry.word !== word);
        saveToHistory(newWords);
        words = newWords;
        
        // Save based on user status
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (user) {
            saveUserDictionary(user.sub);
        } else {
            localStorage.setItem('dictionary', JSON.stringify(words));
        }
        
        updateWordList();
        showMessage(`"${word}" е изтрита успешно`, 'green');
    }
});

// Add click handler for edit button
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-edit')) {
        const wordElement = e.target.closest('.word-card').querySelector('h3');
        const word = wordElement.textContent;
        editWord(word);
    }
});

// Add click handler for move button
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-move')) {
        const wordElement = e.target.closest('.word-card').querySelector('h3');
        const word = wordElement.textContent;
        const wordEntry = words.find(w => w.word === word);
        if (wordEntry) {
            showMoveWordDialog(wordEntry);
        }
    }
});

function showMoveWordDialog(wordEntry) {
    const allFolders = getAllFolders();
    const currentFolder = wordEntry.folder || getFolderFromDate(wordEntry.timestamp);
    
    // Filter out the current folder
    const availableFolders = allFolders.filter(f => f !== currentFolder);
    
    if (availableFolders.length === 0) {
        showMessage('Няма други папки! Създайте нова папка първо.', 'red');
        return;
    }
    
    // Create a simple selection dialog
    let message = `Преместете "${wordEntry.word}" от "${currentFolder}" в:\n\n`;
    availableFolders.forEach((folder, index) => {
        message += `${index + 1}. ${folder}\n`;
    });
    message += `\nВъведете номер (1-${availableFolders.length}):`;
    
    const selection = prompt(message);
    
    if (!selection) return; // User cancelled
    
    const index = parseInt(selection) - 1;
    if (isNaN(index) || index < 0 || index >= availableFolders.length) {
        showMessage('Невалиден избор!', 'red');
        return;
    }
    
    const targetFolder = availableFolders[index];
    moveWordToFolder(wordEntry, targetFolder);
}

function moveWordToFolder(wordEntry, targetFolder) {
    const oldFolder = wordEntry.folder || getFolderFromDate(wordEntry.timestamp);
    
    // Update the word's folder
    wordEntry.folder = targetFolder;
    
    // Save changes
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (user) {
        saveUserDictionary(user.sub);
    } else {
        localStorage.setItem('dictionary_guest', JSON.stringify(words));
    }
    
    // Update UI
    updateWordList();
    showMessage(`"${wordEntry.word}" е преместена от "${oldFolder}" в "${targetFolder}"`, 'green');
}

// Flashcard functionality (updated)
function updateFlashcardWordList() {
    const wordCheckboxes = document.getElementById('flashcard-words');
    if (!wordCheckboxes) return;

    wordCheckboxes.innerHTML = '';
    
    if (words.length === 0) {
        wordCheckboxes.innerHTML = '<div class="empty-state"><p>Няма налични думи</p></div>';
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(words.length / itemsPerPage);
    if (flashcardCurrentPage > totalPages) {
        flashcardCurrentPage = 1;
    }
    
    const startIdx = (flashcardCurrentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageWords = words.slice(startIdx, endIdx);
    
    // Add words for current page
    const wordsHTML = pageWords.map((word, index) => `
        <label class="word-checkbox" data-pos="${word.partOfSpeech}">
            <input type="checkbox" name="flashcardWords" 
                   value="${word.word}" checked>
            <span>${word.word}</span>
            <small class="pos-label ${word.partOfSpeech}">${POS_LABELS[word.partOfSpeech] || word.partOfSpeech}</small>
        </label>
    `).join('');
    
    wordCheckboxes.innerHTML = wordsHTML;
    
    // Add pagination controls if there are multiple pages
    if (totalPages > 1) {
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination-controls flashcard-pagination';
        paginationDiv.innerHTML = `
            <button type="button" class="pagination-btn pagination-prev" ${flashcardCurrentPage === 1 ? 'disabled' : ''}>
                ‹ Предишна
            </button>
            <span class="pagination-info">Страница <span class="current-page">${flashcardCurrentPage}</span> от <span class="total-pages">${totalPages}</span></span>
            <button type="button" class="pagination-btn pagination-next" ${flashcardCurrentPage === totalPages ? 'disabled' : ''}>
                Следваща ›
            </button>
        `;
        wordCheckboxes.appendChild(paginationDiv);
        
        // Add event listeners for pagination buttons
        const prevBtn = paginationDiv.querySelector('.pagination-prev');
        const nextBtn = paginationDiv.querySelector('.pagination-next');
        
        if (prevBtn && nextBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (flashcardCurrentPage > 1) {
                    flashcardCurrentPage--;
                    updateFlashcardWordList();
                }
            });
            
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (flashcardCurrentPage < totalPages) {
                    flashcardCurrentPage++;
                    updateFlashcardWordList();
                }
            });
        }
    }
}

function startFlashcards() {
    const selectedCheckboxes = document.querySelectorAll('input[name="flashcardWords"]:checked');
    if (selectedCheckboxes.length === 0) {
        showMessage('Изберете поне една дума за упражнение!', 'red');
        return;
    }

    let currentIndex = 0;
    const selectedWords = Array.from(selectedCheckboxes)
        .map(cb => words.find(w => w.word === cb.value));
    const shuffledWords = [...selectedWords].sort(() => Math.random() - 0.5);

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'flashcard-modal';
    modal.innerHTML = `
        <div class="flashcard-container">
            <div class="flashcard-progress">Карта ${currentIndex + 1} от ${shuffledWords.length}</div>
            <div class="flashcard">
                <div class="flashcard-inner">
                    <div class="flashcard-front"></div>
                    <div class="flashcard-back"></div>
                </div>
            </div>
            <div class="flashcard-controls">
                <button class="btn btn-secondary" id="prev-card" disabled>
                    ← Предишна (←)
                </button>
                <button class="btn btn-primary" id="next-card" ${shuffledWords.length === 1 ? 'disabled' : ''}>
                    Следваща (→)
                </button>
            </div>
            <div class="keyboard-shortcuts">
                <div class="keyboard-shortcut">
                    <span class="key">←</span>
                    <span>Предишна карта</span>
                </div>
                <div class="keyboard-shortcut">
                    <span class="key">Space</span>
                    <span>Обърни картата</span>
                </div>
                <div class="keyboard-shortcut">
                    <span class="key">→</span>
                    <span>Следваща карта</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));

    const flashcard = modal.querySelector('.flashcard-inner');
    const prevButton = modal.querySelector('#prev-card');
    const nextButton = modal.querySelector('#next-card');
    const progressText = modal.querySelector('.flashcard-progress');

    function updateCard() {
        const card = shuffledWords[currentIndex];
        const front = flashcard.querySelector('.flashcard-front');
        const back = flashcard.querySelector('.flashcard-back');
        flashcard.style.opacity = '0';
        setTimeout(() => {
            front.innerHTML = `
                <div class="flashcard-front-top">
                    <span class="pos-label ${card.partOfSpeech}">${POS_LABELS[card.partOfSpeech] || card.partOfSpeech}</span>
                </div>
                <div class="flashcard-word">${card.word}</div>
                <div class="flip-hint">Кликнете за определението</div>
            `;
            back.innerHTML = `
                <div class="flashcard-back-top">
                    <span class="pos-label ${card.partOfSpeech}">${POS_LABELS[card.partOfSpeech] || card.partOfSpeech}</span>
                </div>
                <div class="flashcard-definition">${card.definition}</div>
                <div class="flip-hint">Кликнете за думата</div>
            `;
            progressText.textContent = `Карта ${currentIndex + 1} от ${shuffledWords.length}`;
            flashcard.classList.remove('flipped');
            prevButton.disabled = currentIndex === 0;
            nextButton.disabled = currentIndex === shuffledWords.length - 1;
            flashcard.style.opacity = '1';
        }, 200);
    }

    // Initialize first card
    updateCard();

    function closeFlashcards() {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            document.removeEventListener('keydown', handleKeydown);
        }, 300);
    }

    // Use one keydown listener
    function handleKeydown(e) {
        if (e.key === 'Escape') {
            closeFlashcards();
        } else if (e.key === 'ArrowLeft' && !prevButton.disabled) {
            prevButton.click();
        } else if (e.key === 'ArrowRight' && !nextButton.disabled) {
            nextButton.click();
        } else if (e.code === 'Space' || e.key === ' ') {
            // Support both modern and older browsers for Space key detection
            e.preventDefault();
            flashcard.click();
        }
    }
    document.addEventListener('keydown', handleKeydown);

    const flashcardInner = modal.querySelector('.flashcard-inner');
    flashcardInner.addEventListener('click', () => {
        flashcardInner.classList.toggle('flipped');
    });
    prevButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentIndex > 0) {
            currentIndex--;
            updateCard();
        }
    });
    nextButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentIndex < shuffledWords.length - 1) {
            currentIndex++;
            updateCard();
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeFlashcards();
        }
    });
}

function showQuizConfig() {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'quiz-modal-overlay';
    
    const selectedWords = new Set();
    const wordsList = words.map(w => w.word);
    
    modalOverlay.innerHTML = `
        <div class="quiz-modal">
            <button class="quiz-close" onclick="closeQuizConfig()">×</button>
            <form class="quiz-config-form" id="quiz-config-form">
                <h2>Настройки на теста</h2>
                
                <div class="form-group">
                    <label for="questionCount">Брой въпроси:</label>
                    <input type="number" id="questionCount" min="1" max="${words.length}" 
                           value="${Math.min(10, words.length)}" required>
                </div>
                
                <div class="form-group">
                    <label>Тип на въпросите:</label>
                    <div class="quiz-type-options">
                        <label class="quiz-option">
                            <input type="radio" name="quizType" value="multiple" checked>
                            <span class="option-text">Дефиниции: затворен отговор</span>
                        </label>
                        <label class="quiz-option">
                            <input type="radio" name="quizType" value="open">
                            <span class="option-text">Дефиниции: отворен отговор</span>
                        </label>
                        <label class="quiz-option">
                            <input type="radio" name="quizType" value="reading">
                            <span class="option-text">
                                Четене с разбиране
                            </span>
                        </label>
                        <label class="quiz-option">
                            <input type="radio" name="quizType" value="gap">
                            <span class="option-text">Попълни празното място</span>
                        </label>
                        <label class="quiz-option">
                            <input type="radio" name="quizType" value="gap-verb-form">
                            <span class="option-text">Попълни глагола в правилната форма</span>
                        </label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Избери думи за теста:</label>
                    <div class="word-selection">
                        <div class="word-filters">
                            <input type="search" id="quiz-word-search" 
                                   placeholder="Търси думи..." class="search-input">
                            <select id="quiz-pos-filter" class="select-filter">
                                <option value="any">Всички части на речта</option>
                                <option value="noun">Съществително име</option>
                                <option value="verb">Глагол</option>
                                <option value="adjective">Прилагателно име</option>
                                <option value="adverb">Наречие</option>
                            </select>
                            <button type="button" class="btn btn-secondary" id="select-all">Избери всички</button>
                            <button type="button" class="btn btn-secondary" id="deselect-all">Премахни всички</button>
                        </div>
                        <div class="word-checkboxes" id="quiz-word-checkboxes"></div>
                    </div>
                </div>
                
                <div class="quiz-controls">
                    <button type="submit" class="btn btn-primary">
                        Започни теста
                    </button>
                </div>
            </form>
        </div>
    `;
    
    const searchInput = modalOverlay.querySelector('#quiz-word-search');
    const posFilter = modalOverlay.querySelector('#quiz-pos-filter');
    const wordCheckboxesContainer = modalOverlay.querySelector('#quiz-word-checkboxes');
    const selectAll = modalOverlay.querySelector('#select-all');
    const deselectAll = modalOverlay.querySelector('#deselect-all');

    document.body.appendChild(modalOverlay);
    modalOverlay.style.display = 'flex';
    
    // Reset pagination when opening quiz config
    quizCurrentPage = 1;
    
    // Handle select/deselect all
    const checkboxes = () => modalOverlay.querySelectorAll('input[name="selectedWords"]');

    selectAll.addEventListener('click', (e) => {
        e.preventDefault();
        const visibleCheckboxes = Array.from(checkboxes()).filter(
            cb => cb.closest('.word-checkbox').style.display !== 'none'
        );
        visibleCheckboxes.forEach(cb => cb.checked = true);
    });
    
    deselectAll.addEventListener('click', (e) => {
        e.preventDefault();
        const visibleCheckboxes = Array.from(checkboxes()).filter(
            cb => cb.closest('.word-checkbox').style.display !== 'none'
        );
        visibleCheckboxes.forEach(cb => cb.checked = false);
    });

    // Handle form submission
    const configForm = modalOverlay.querySelector('#quiz-config-form');
    configForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const questionCount = parseInt(document.getElementById('questionCount').value);
        const quizType = document.querySelector('input[name="quizType"]:checked').value;
        const selectedWords = Array.from(checkboxes())
            .filter(cb => cb.checked)
            .map(cb => words.find(w => w.word === cb.value));
        
        if (selectedWords.length < 4 && quizType === 'multiple') {
            showMessage('Изберете поне 4 думи за тест с избор на отговор', 'red');
            return;
        }
        
        if (selectedWords.length < 1) {
            showMessage('Изберете поне една дума за теста', 'red');
            return;
        }
        
        modalOverlay.remove();
        generateQuestion(questionCount, quizType, selectedWords);
    });
    

    // Update filter and pagination logic
    function updateQuizWordDisplay() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedPos = posFilter.value;
        
        // Filter words based on search and POS
        let filteredWords = words.filter(word => {
            const matchesSearch = word.word.toLowerCase().includes(searchTerm);
            const matchesPos = selectedPos === 'any' || word.partOfSpeech === selectedPos;
            return matchesSearch && matchesPos;
        });
        
        const totalPages = Math.ceil(filteredWords.length / itemsPerPage);
        if (quizCurrentPage > totalPages) {
            quizCurrentPage = Math.max(1, totalPages);
        }
        
        // Get words for current page
        const startIdx = (quizCurrentPage - 1) * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const pageWords = filteredWords.slice(startIdx, endIdx);
        
        // Clear and rebuild word checkboxes
        wordCheckboxesContainer.innerHTML = pageWords.map(word => `
            <label class="word-checkbox" 
                   data-word="${word.word.toLowerCase()}"
                   data-pos="${word.partOfSpeech}">
                <input type="checkbox" name="selectedWords" 
                       value="${word.word}" checked>
                <span>${word.word}</span>
                <small class="pos-label ${word.partOfSpeech}">
                    ${POS_LABELS[word.partOfSpeech] || word.partOfSpeech}
                </small>
            </label>
        `).join('');
        
        // Add pagination controls if there are multiple pages
        if (totalPages > 1) {
            const paginationDiv = document.createElement('div');
            paginationDiv.className = 'pagination-controls quiz-pagination';
            paginationDiv.innerHTML = `
                <button type="button" class="pagination-btn pagination-prev" ${quizCurrentPage === 1 ? 'disabled' : ''}>
                    ‹ Предишна
                </button>
                <span class="pagination-info">Страница <span class="current-page">${quizCurrentPage}</span> от <span class="total-pages">${totalPages}</span></span>
                <button type="button" class="pagination-btn pagination-next" ${quizCurrentPage === totalPages ? 'disabled' : ''}>
                    Следваща ›
                </button>
            `;
            wordCheckboxesContainer.appendChild(paginationDiv);
            
            // Add event listeners for pagination buttons
            const prevBtn = paginationDiv.querySelector('.pagination-prev');
            const nextBtn = paginationDiv.querySelector('.pagination-next');
            
            if (prevBtn && nextBtn) {
                prevBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (quizCurrentPage > 1) {
                        quizCurrentPage--;
                        updateQuizWordDisplay();
                    }
                });
                
                nextBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (quizCurrentPage < totalPages) {
                        quizCurrentPage++;
                        updateQuizWordDisplay();
                    }
                });
            }
        }
    }
    
    // Initial display and event listeners
    updateQuizWordDisplay();
    searchInput.addEventListener('input', () => {
        quizCurrentPage = 1;
        updateQuizWordDisplay();
    });
    posFilter.addEventListener('change', () => {
        quizCurrentPage = 1;
        updateQuizWordDisplay();
    });
}

function closeQuizConfig() {
    const modalOverlay = document.querySelector('.quiz-modal-overlay');
    if (modalOverlay) {
        modalOverlay.style.opacity = '0';
        modalOverlay.style.transform = 'scale(0.95)';
        setTimeout(() => {
            modalOverlay.style.display = 'none';
            modalOverlay.remove();
        }, 300);
    }
}

function saveQuizResult(score, totalQuestions, selectedWords) {
    const quizHistory = JSON.parse(localStorage.getItem(QUIZ_HISTORY_KEY) || '[]');
    const newResult = {
        date: new Date().toISOString(),
        score: score,
        totalQuestions: totalQuestions,
        percentage: Math.round((score / totalQuestions) * 100),
        wordsCount: selectedWords.length
    };
    
    quizHistory.unshift(newResult); // Add new result to the beginning
    
    // Keep only the last 10 results
    if (quizHistory.length > 10) {
        quizHistory.pop();
    }
    
    localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(quizHistory));
    updateQuizHistory();
}

function updateQuizHistory() {
    const historyList = document.querySelector('.quiz-history-list');
    if (!historyList) return;

    const quizHistory = JSON.parse(localStorage.getItem(QUIZ_HISTORY_KEY) || '[]');
    
    if (quizHistory.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <p>Все още няма направени тестове.</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = quizHistory.map(result => {
        const date = new Date(result.date).toLocaleDateString('bg-BG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let badge;
        if (result.percentage >= 80) {
            badge = '<span class="quiz-history-badge excellent">Отлично</span>';
        } else if (result.percentage >= 60) {
            badge = '<span class="quiz-history-badge good">Добре</span>';
        } else {
            badge = '<span class="quiz-history-badge needs-practice">Нужда от упражнение</span>';
            }

        return `
            <div class="quiz-history-item">
                <div class="quiz-history-date">${date}</div>
                <div class="quiz-history-info">
                    <div class="quiz-history-score">
                        ${result.score}/${result.totalQuestions} въпроса (${result.percentage}%)
                    </div>
                    <div class="quiz-history-details">
                        Брой думи в теста: ${result.wordsCount}
                    </div>
                </div>
                ${badge}
            </div>
        `;
    }).join('');
}

// Make speakWord globally available
window.speakWord = function(word) {
    const utterance = new SpeechSynthesisUtterance(word);
   utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
}

// Add this helper function near the top with other utility functions
function areSimilarDefinitions(def1, def2) {
    const similarity = def1.toLowerCase().split(' ')
        .filter(word => def2.toLowerCase().includes(word)).length;
    return similarity > 3; // Consider similar if more than 3 words match
}

// Add this function near the top with other utility functions
function saveToHistory(newWords) {
    // Remove any future history if we're not at the latest state
    if (currentHistoryIndex < dictionaryHistory.length - 1) {
        dictionaryHistory = dictionaryHistory.slice(0, currentHistoryIndex + 1);
    }
    
    // Add new state
    dictionaryHistory.push(JSON.stringify(newWords));
    if (dictionaryHistory.length > MAX_HISTORY) {
        dictionaryHistory.shift();
    }
    currentHistoryIndex = dictionaryHistory.length - 1;
    
    // Update history buttons state
    updateHistoryButtonsState();
}

function updateHistoryButtonsState() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn && redoBtn) {
        undoBtn.disabled = currentHistoryIndex <= 0;
        redoBtn.disabled = currentHistoryIndex >= dictionaryHistory.length - 1;
    }
}

function undo() {
    if (currentHistoryIndex > 0) {
        currentHistoryIndex--;
        words = JSON.parse(dictionaryHistory[currentHistoryIndex]);
        
        // Save the current state
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (user) {
            saveUserDictionary(user.sub);
        } else {
            localStorage.setItem('dictionary', JSON.stringify(words));
        }
        
        updateWordList();
        updateHistoryButtonsState();
    }
}

function redo() {
    if (currentHistoryIndex < dictionaryHistory.length - 1) {
        currentHistoryIndex++;
        words = JSON.parse(dictionaryHistory[currentHistoryIndex]);
        
        // Save the current state
        const user = JSON.parse(sessionStorage.getItem('user'));
        if (user) {
            saveUserDictionary(user.sub);
        } else {
            localStorage.setItem('dictionary', JSON.stringify(words));
        }
        
        updateWordList();
        updateHistoryButtonsState();
    }
}

function showExportModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal export-modal">
            <h3>Изтегли речника</h3>
            <div class="export-options">
                <button class="btn btn-secondary" data-format="txt">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Text файл (.txt)
                </button>
                <button class="btn btn-secondary" data-format="csv">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    CSV файл (.csv)
                </button>
                <button class="btn btn-secondary" data-format="json">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    JSON файл (.json)
                </button>
            </div>
            <button class="modal-close">×</button>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));

    // Close button handler
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    });

    // Format selection handlers
    modal.querySelectorAll('.export-options button').forEach(btn => {
        btn.addEventListener('click', () => {
            const format = btn.dataset.format;
            exportDictionary(format);
            modal.querySelector('.modal-close').click();
        });
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.querySelector('.modal-close').click();
        }
    });
}

function exportDictionary(format) {
    let content = '';
    let filename = `dictionary_${new Date().toISOString().split('T')[0]}`;
    let type = '';

    switch (format) {
        case 'txt':
            content = words.map(w => 
                `${w.word}\n${w.definition}\nPart of speech: ${w.partOfSpeech}\n\n`
            ).join('---\n');
            type = 'text/plain;charset=utf-8';
            filename += '.txt';
            break;
            
        case 'csv':
            content = 'Word,Definition,Part of Speech\n' + 
                     words.map(w => 
                         `"${w.word}","${w.definition}","${w.partOfSpeech}"`
                     ).join('\n');
            type = 'text/csv;charset=utf-8';
            filename += '.csv';
            break;
            
        case 'json':
            content = JSON.stringify(words, null, 2);
            type = 'application/json;charset=utf-8';
            filename += '.json';
            break;
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showMessage('Речникът е изтеглен успешно', 'green');
}

// Supabase bridge overrides keep legacy UI while moving state to backend.
(function enableSupabaseRuntime() {
    const originalFetch = window.fetch.bind(window);

    async function getBridge() {
        if (window.supabaseBridge) return window.supabaseBridge;
        if (window.supabaseBridgeReady) return await window.supabaseBridgeReady;
        return null;
    }

    window.fetch = async function(input, init = {}) {
        const bridge = await getBridge();
        if (!bridge) return originalFetch(input, init);

        const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        const oldApiBase = 'http://127.0.0.1:8001';
        if (!url.startsWith(oldApiBase)) {
            return originalFetch(input, init);
        }

        const endpoint = url.replace(oldApiBase, '').replace(/^\//, '');
        try {
            if (endpoint === 'structure-words') {
                const formData = init && init.body instanceof FormData ? init.body : null;
                const file = formData ? formData.get('file') : null;
                const rawText = file ? await file.text() : '';
                const text = await bridge.structureWords(rawText);
                return new Response(text, {
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }

            const jsonBody = init && init.body ? JSON.parse(init.body) : {};
            const data = await bridge.invokeAi(endpoint, jsonBody);
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: String(error) }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    };

    window.initializeGoogleSignIn = async function() {
        const authContainer = document.getElementById('google-signin-container');
        if (!authContainer) return;

        authContainer.innerHTML = '';
        const user = JSON.parse(sessionStorage.getItem('user') || 'null');
        if (user) {
            updateAuthUI();
            return;
        }

        // Show the button immediately — wait for bridge only on click
        const btn = document.createElement('button');
        btn.className = 'cta-btn';
        btn.textContent = 'Влез с Google';
        btn.addEventListener('click', async () => {
            try {
                // Prevent stale guest mode from overriding authenticated flow.
                localStorage.removeItem('isGuest');
                const bridge = await getBridge();
                if (!bridge) {
                    showMessage('Грешка: модулът за вход не е зареден. Презаредете страницата.', 'red');
                    return;
                }
                await bridge.signInWithGoogle();
            } catch (err) {
                showMessage('Грешка при входа', 'red');
                console.error('Supabase sign-in error:', err);
            }
        });
        authContainer.appendChild(btn);
    };

    window.handleCredentialResponse = async function() {
        const bridge = await getBridge();
        if (!bridge) return;
        await bridge.signInWithGoogle();
    };

    window.loadUserDictionary = function() {
        (async () => {
            try {
                const bridge = await getBridge();
                if (!bridge) return;
                words = await bridge.fetchWordsLegacy();
                dictionaryHistory = [JSON.stringify(words)];
                currentHistoryIndex = 0;
                updateWordList();
            } catch (error) {
                console.error('Supabase dictionary load failed:', error);
                showMessage('Грешка при зареждане от Supabase', 'red');
            }
        })();
    };

    window.saveUserDictionary = function() {
        (async () => {
            try {
                const bridge = await getBridge();
                if (!bridge) return;
                await bridge.syncWords(words);
            } catch (error) {
                console.error('Supabase dictionary save failed:', error);
            }
        })();
        return true;
    };

    window.signOut = async function() {
        const bridge = await getBridge();
        if (!bridge) return;
        if (!confirm('Сигурни ли сте, че искате да излезете?')) return;
        await bridge.signOutUser();
        localStorage.removeItem('isGuest');
        sessionStorage.removeItem('user');
        window.location.href = 'index.html';
    };

    window.saveQuizResult = function(score, totalQuestions, selectedWords) {
        (async () => {
            const bridge = await getBridge();
            if (!bridge) return;
            await bridge.saveQuizResult({
                score,
                totalQuestions,
                selectedWords,
                quizType: 'mixed'
            });
            updateQuizHistory();
        })().catch((e) => console.error('Failed to save quiz result:', e));
    };

    window.updateQuizHistory = function() {
        (async () => {
            const historyList = document.querySelector('.quiz-history-list');
            if (!historyList) return;
            const bridge = await getBridge();
            if (!bridge) return;

            const quizHistory = await bridge.fetchQuizHistory(10);
            if (quizHistory.length === 0) {
                historyList.innerHTML = '<div class="empty-state"><p>Все още няма направени тестове.</p></div>';
                return;
            }

            historyList.innerHTML = quizHistory.map(result => {
                const date = new Date(result.date).toLocaleDateString('bg-BG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                let badge = '<span class="quiz-history-badge needs-practice">Нужда от упражнение</span>';
                if (result.percentage >= 80) {
                    badge = '<span class="quiz-history-badge excellent">Отлично</span>';
                } else if (result.percentage >= 60) {
                    badge = '<span class="quiz-history-badge good">Добре</span>';
                }

                return `
                    <div class="quiz-history-item">
                        <div class="quiz-history-date">${date}</div>
                        <div class="quiz-history-info">
                            <div class="quiz-history-score">${result.score}/${result.totalQuestions} въпроса (${result.percentage}%)</div>
                            <div class="quiz-history-details">Брой думи в теста: ${result.wordsCount}</div>
                        </div>
                        ${badge}
                    </div>
                `;
            }).join('');
        })().catch((e) => console.error('Failed to load quiz history:', e));
    };

    // When the Supabase bridge resolves auth late (e.g. PKCE code exchange completes after
    // DOMContentLoaded), re-render the auth UI and load the user's dictionary.
    window.addEventListener('supabaseAuthMirror', (e) => {
        updateAuthUI();
        const mirrorUser = e.detail;
        if (mirrorUser && (window.location.pathname.includes('app.html') || window.location.pathname === '/app')) {
            loadCustomFolders();
            loadUserDictionary(mirrorUser.sub);
        }
    });

    document.addEventListener('DOMContentLoaded', async () => {
        const isAppPage = window.location.pathname.includes('app.html') || window.location.pathname === '/app';
        const isGuest = localStorage.getItem('isGuest') === 'true';
        const hasOAuthHash = /access_token=|refresh_token=|provider_token=/.test(window.location.hash || '');
        const hasOAuthQuery = /(^|&)(code|state|access_token|refresh_token)=/.test((window.location.search || '').replace(/^\?/, ''));
        const hasOAuthCallback = hasOAuthHash || hasOAuthQuery;

        const bridge = await getBridge();
        if (!bridge) {
            if (isAppPage && !isGuest && !hasOAuthCallback) {
                window.location.href = 'index.html';
            }
            return;
        }

        let user = await bridge.getCurrentUser();

        // Supabase may need a moment to exchange OAuth callback params and persist session.
        if (!user && hasOAuthCallback) {
            for (let i = 0; i < 5 && !user; i += 1) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                user = await bridge.getCurrentUser();
            }
        }

        if (!isAppPage && user) {
            window.location.href = 'app.html';
            return;
        }

        if (isAppPage && user) {
            localStorage.removeItem('isGuest');
            // Ensure dictionary loads after auth is actually hydrated.
            loadCustomFolders();
            loadUserDictionary(user.sub);
            updateAuthUI();

            // Clean OAuth callback params from URL after successful hydration.
            if (hasOAuthCallback) {
                const cleanUrl = `${window.location.origin}/app.html`;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        }

        if (isAppPage && !user && !isGuest) {
            window.location.href = 'index.html';
            return;
        }

        if (!isAppPage) {
            initializeGoogleSignIn();
        }
    });
})();
