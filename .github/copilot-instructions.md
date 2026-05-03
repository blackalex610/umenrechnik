# GitHub Copilot Instructions

## Project Overview
This project is an interactive tool for learning new words, designed to be lightweight, offline, and user-friendly. It includes features such as a dictionary, flashcards, quizzes, and local file import functionality. The application is modular, ensuring encapsulation, data security, and scalability.

### Key Technologies
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Authentication**: Google OAuth 2.0
- **Data Storage**: LocalStorage and SessionStorage
- **Libraries**: JWT Decode, Google GSI Client

## Architecture
The application is divided into the following modules:
- **Frontend**: Handles user interface and interactions.
- **Authentication**: Manages user login via Google OAuth 2.0.
- **Dictionary Management**: Allows adding, editing, and deleting words.
- **Flashcards**: Provides an interactive learning experience.
- **Quizzes**: Generates dynamic tests based on the dictionary.
- **Local File Import**: Enables bulk addition of words from a file.

## Developer Workflows

### Build and Run
This project is a static web application. Open `index.html` in a browser to start the application.

### Testing
- Ensure at least 4 words are added to the dictionary before starting a quiz.
- Use the Google OAuth 2.0 flow to test authentication.

### Debugging
- Check `LocalStorage` and `SessionStorage` for stored data.
- Use browser developer tools to inspect DOM updates and JavaScript console logs.

## Project-Specific Conventions

### File Structure
- `index.html`: Entry point with a minimalistic UI.
- `app.html`: Core functionality (dictionary, flashcards, quizzes, import).
- `script.js`: Manages dynamic logic, including authentication, dictionary updates, and UI interactions.
- `style.css`: Defines themes, animations, and responsive design.

### Patterns
- **Encapsulation**: Each feature (e.g., dictionary, flashcards) is isolated to prevent conflicts.
- **Validation**: Input data is sanitized to prevent XSS attacks.
- **Dynamic Views**: Sections like dictionary and flashcards are toggled dynamically using JavaScript.

### Examples
- **Flashcards**: Use `.flashcard-modal` for modals and `.flipped` for animations.
- **Quizzes**: Randomize answers and track progress with a progress bar.

## Integration Points
- **Google OAuth 2.0**: Handles user authentication.
- **Local File Import**: Processes file content into dictionary entries.

## External Dependencies
- **JWT Decode**: Decodes authentication tokens.
- **Google GSI Client**: Manages Google Sign-In.

## Future Enhancements
- Cloud storage integration (e.g., Firebase, AWS).
- AI-based recommendations and chat assistant.
- Localization and multi-language support.

---

For detailed technical insights, refer to `fsfsfs.txt`.