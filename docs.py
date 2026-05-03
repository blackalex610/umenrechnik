import os
import json
import google.auth
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Path to your downloaded credentials JSON
credentials_file = 'credentials.json'

# If modifying the document, set SCOPES to 'https://www.googleapis.com/auth/documents'
SCOPES = ['https://www.googleapis.com/auth/documents.readonly']

def authenticate_google_docs():
    # Authenticate and create the Google Docs API client
    flow = InstalledAppFlow.from_client_secrets_file(credentials_file, SCOPES)
    creds = flow.run_local_server(port=62499)
    service = build('docs', 'v1', credentials=creds)
    return service

def get_document_content(service, document_id):
    # Fetch the document content
    document = service.documents().get(documentId=document_id).execute()
    return document

def ai_process_document_text(document_text):
    # This function uses the AI to extract words and definitions intelligently
    # For simplicity, assume the AI understands that words should have definitions
    # In real use, you'd pass this to GPT-4o for further processing
    words = []
    lines = document_text.split('\n')
    
    for line in lines:
        if ":" in line:  # Simple check to look for a word-definition pair
            word, definition = line.split(":", 1)
            words.append({"word": word.strip(), "definition": definition.strip()})
    
    # Here we could call GPT-4o for additional filtering/validation if necessary
    return words

def main():
    # Authenticate and get the service
    service = authenticate_google_docs()

    # Provide the actual Google Doc ID here
    document_id = '16-E5tbDOmzl9uxhNI7ivw5S693hiFCoyD0tRnPqB-wc'  # Replace with your actual Google Doc ID
    
    # Get the content of the document
    document = get_document_content(service, document_id)

    # Extract text content from the document
    document_text = ''
    for element in document.get('body').get('content'):
        if 'paragraph' in element:
            for paragraph_element in element.get('paragraph').get('elements'):
                document_text += paragraph_element.get('textRun', {}).get('content', '')

    # Process the text content to extract words
    words = ai_process_document_text(document_text)

    # Print out the words (this is where you would add the words to your app)
    print(json.dumps(words, indent=2))

if __name__ == '__main__':
    main()
