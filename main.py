from fastapi import FastAPI
from fastapi import UploadFile, File
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import List, Dict, Optional, Union
from fastapi.middleware.cors import CORSMiddleware
import os
import openai
from dotenv import load_dotenv
from fastapi import Body
from openai import OpenAI


# Load environment variables (for local dev)
load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- OpenAI client setup ---
_openai_key = os.getenv("OPENAI_API_KEY")
if not _openai_key:
    raise RuntimeError("OPENAI_API_KEY environment variable is not set. Copy .env.example to .env and fill in your key.")
client = OpenAI(api_key=_openai_key)


# Request models
class Word(BaseModel):
    word: str
    definition: str
    partOfSpeech: str
    timestamp: Optional[Union[str, int]] = None

class ChatRequest(BaseModel):
    message: str
    words: List[Word] = []

class WrongAnswerRequest(BaseModel):
    word: str
    definition: str
    partOfSpeech: str

class ReadingRequest(BaseModel):
    words: List[str]
    language: Optional[str] = "English"
    questionCount: Optional[int] = 3
    multipleChoice: Optional[bool] = True
    optionsPerQuestion: Optional[int] = 4

class OpenClauseRequest(BaseModel):
    word: str
    definition: str
    partOfSpeech: str

class GapFillRequest(BaseModel):
    word: str
    definition: str
    partOfSpeech: str

class GapFillVerbFormRequest(BaseModel):
    word: str
    definition: str
    partOfSpeech: str


@app.post("/structure-words")
async def structure_words(file: UploadFile = File(...)):
    contents = await file.read()
    raw_text = contents.decode("utf-8")

    # Construct the prompt for the AI
    prompt = (
    "You will receive a list of unstructured or partially structured word entries, written in English or Bulgarian.\n"
    "Your task is to convert them into a clean CSV-like format with the structure:\n"
    "word,definition,part of speech\n\n"
    "Rules:\n"
    "- If the definition is missing, guess a reasonable one.\n"
    "- If the part of speech is missing, infer it.\n"
    "- If the part of speech is written in Bulgarian, translate it to English.\n"
    "- Keep the output clean: one word per line, no headers, no numbering.\n"
    "- Use lowercase for the word, capitalize the definition.\n"
    "- Preserve the original language of the word and definition (e.g., if the word is in Bulgarian, keep the definition in Bulgarian).\n"
    "- Always output the part of speech in English: noun, verb, adjective, or adverb.\n"
    "- Example (English): dog,A domesticated animal,noun\n"
    "- Example (Bulgarian): куче,Домашно животно,noun\n\n"
    "Here is the input:\n"
    + raw_text
)





    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful AI that cleans up word lists for a dictionary app."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=1500
        )
        structured_text = response.choices[0].message.content.strip()

        # Return the structured text back to the frontend
        return PlainTextResponse(content=structured_text, media_type="text/plain")

    except Exception as e:
        return {"error": str(e)}

@app.post("/chat")
async def chat(req: ChatRequest):
    user_message = req.message
    words = req.words or []

    word_summary = "\n".join([f"- {w.word}: {w.definition}" for w in words])

    system_message = (
        "You have access to a personalized dictionary. You can add or remove words as needed. "
        "Only use the dictionary words if the user asks specifically about them or mentions them explicitly. "
        "Feel free to add new words when they are introduced in the conversation.\n\n"
        "Here is the user's current dictionary:\n" + word_summary
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            temperature=0.5,
            max_tokens=1000,
            top_p=1
        )

        return {
            "response": response.choices[0].message.content,
            "error": None
        }

    except Exception as e:
        print(f"Chat error: {str(e)}")
        return {
            "response": None,
            "error": str(e)
        }

@app.post("/generate-wrong-answers")
async def generate_wrong_answers(req: WrongAnswerRequest):
    try:
        prompt = f"""
Generate 4 definitions for the word "{req.word}" ({req.partOfSpeech}):
1. A correct, formal definition (without using the word in the definition)
2-4. Three plausible but incorrect definitions

Requirements for all definitions:
- Must match part of speech: {req.partOfSpeech}
- Similar formality and length
- Must be unique and clear
- Must NOT contain the word "{req.word}"
- Must stand alone as complete definitions
- No numbers, prefixes, or labels

Format: Just the definitions, one per line.
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a lexicographer who creates precise definitions. Always return exactly 4 lines."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )

        # Clean and validate the responses
        all_answers = [
            # Remove numbers, extra spaces, and ensure proper ending
            ans.strip()
            .lstrip("0123456789.-) ")
            .replace(req.word, "")
            .strip()
            for ans in response.choices[0].message.content.strip().split('\n')
            if ans.strip()
        ]

        # Filter out empty lines and ensure unique answers
        all_answers = list(dict.fromkeys(filter(None, all_answers)))
        
        # If we don't have exactly 4 valid answers, use fallback
        if len(all_answers) != 4:
            return {
                "correctAnswer": req.definition,
                "wrongAnswers": [
                    f"A type of {req.partOfSpeech} expressing an alternate concept.",
                    f"A different kind of {req.partOfSpeech} with another meaning.",
                    f"A distinct form of {req.partOfSpeech} with separate usage."
                ]
            }

        return {
            "correctAnswer": all_answers[0],
            "wrongAnswers": all_answers[1:4]
        }

    except Exception as e:
        print(f"Error generating answers: {str(e)}")
        # Return fallback with original definition
        return {
            "correctAnswer": req.definition,
            "wrongAnswers": [
                f"Alternative meaning for {req.word}.",
                f"Different definition of {req.word}.",
                f"Another meaning of {req.word}."
            ]
        }

@app.post("/generate-reading-comprehension")
async def generate_reading_comprehension(req: ReadingRequest):
    try:
        word_list = ", ".join(req.words)
        prompt = f"""
Generate a {req.language.lower()} reading comprehension passage using the following words: {word_list}.
- The passage should be around 100-150 words.
- Make sure to use all the words naturally in context.
- Generate {req.questionCount} multiple choice questions.
- For each question, provide exactly 4 options labeled A, B, C or D.
- The questions should test both general comprehension and specific word usage.
- Make sure exactly one answer is correct for each question.
- Don't reveal the correct answers in the question text.

Format:
Passage:
<text>

Questions:
1. Question text?
   A) Option 1
   B) Option 2
   C) Option 3
   D) Option 4


Answers:
1. Correct letter (A/B/C/D)
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an educational AI that creates clear reading passages with unambiguous single-choice questions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.6,
            max_tokens=1000
        )

        return {"content": response.choices[0].message.content.strip()}

    except Exception as e:
        print(f"Error generating reading comprehension: {str(e)}")
        return {"error": str(e)}

@app.post("/generate-open-clause")
async def generate_open_clause(req: OpenClauseRequest):
    try:
        prompt = f"""
Generate one clear question to test knowledge of the word "{req.word}" ({req.partOfSpeech}).
The question should be challenging but precise, and the only correct answer must be "{req.word}".

Requirements:
- Use creative question formats (e.g., "What word means...", "Which term describes...", etc.)
- Must NOT contain the word "{req.word}" or obvious synonyms
- Must be clear enough that only "{req.word}" is the correct answer
- No multiple choice options - this is an open answer question

Format: Return exactly one question in a single line.
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at creating clear, precise word questions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )

        # Clean and validate the question
        question = response.choices[0].message.content.strip()
        question = question.lstrip("0123456789.-) ").replace(req.word, "___").strip()

        if not question:
            question = f"What {req.partOfSpeech} is defined as: {req.definition}?"

        return {
            "question": question,
            "answer": req.word
        }

    except Exception as e:
        print(f"Error generating open clause question: {str(e)}")
        return {
            "question": f"What {req.partOfSpeech} means: {req.definition}?",
            "answer": req.word
        }

@app.post("/generate-gap-fill")
async def generate_gap_fill(req: GapFillRequest):
    try:
        prompt = f"""
Create one fill-in-the-gap sentence for the word "{req.word}" ({req.partOfSpeech}).
- The sentence must be natural and clear, and the only correct answer for the gap must be "{req.word}".
- Do NOT use the word "{req.word}" in the sentence; instead, use a blank (____) where the word should go.
- The sentence must make sense only with "{req.word}" as the answer.
- Do not give hints or synonyms in the sentence.
- Use the correct part of speech: {req.partOfSpeech}.
- Do not reveal the answer in the sentence.

Format:
Sentence: <sentence with ____ as the gap>
Answer: <the correct word>
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at creating fill-in-the-gap language exercises."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300
        )
        content = response.choices[0].message.content.strip()
        # Parse the AI response
        import re
        sentence_match = re.search(r"Sentence:\s*(.+)", content)
        answer_match = re.search(r"Answer:\s*(.+)", content)
        sentence = sentence_match.group(1).strip() if sentence_match else None
        answer = answer_match.group(1).strip() if answer_match else req.word

        # Fallback if AI doesn't follow format
        if not sentence:
            sentence = f"The word ____ means: {req.definition}"

        return {
            "sentence": sentence,
            "answer": answer
        }
    except Exception as e:
        print(f"Error generating gap fill: {str(e)}")
        return {
            "sentence": f"The word ____ means: {req.definition}",
            "answer": req.word
        }

@app.post("/generate-gap-fill-verb-form")
async def generate_gap_fill_verb_form(req: GapFillVerbFormRequest):
    try:
        prompt = f"""
Create one fill-in-the-gap sentence for the verb "{req.word}".
- The sentence must require the correct form of the verb "{req.word}" in context (e.g., tense, person, number, etc.).
- Use a blank (____) where the verb should go.
- The sentence must make sense only with the correct form of "{req.word}" as the answer.
- Do NOT use the base form unless it is correct for the context.
- Do not give hints or synonyms in the sentence.
- Do not reveal the answer in the sentence.
- The answer should be the correct form of the verb for the blank.

Format:
Sentence: <sentence with ____ as the gap>
Answer: <the correct verb form>
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at creating fill-in-the-gap verb form exercises."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300
        )
        content = response.choices[0].message.content.strip()
        import re
        sentence_match = re.search(r"Sentence:\s*(.+)", content)
        answer_match = re.search(r"Answer:\s*(.+)", content)
        sentence = sentence_match.group(1).strip() if sentence_match else None
        answer = answer_match.group(1).strip() if answer_match else req.word

        if not sentence:
            sentence = f"____: {req.definition}"

        return {
            "sentence": sentence,
            "answer": answer
        }
    except Exception as e:
        print(f"Error generating gap fill verb form: {str(e)}")
        return {
            "sentence": f"____: {req.definition}",
            "answer": req.word
        }



