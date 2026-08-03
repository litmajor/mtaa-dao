import os
from google import genai
from google.genai import types

# 1. Configuration
TARGET_DIR = "c:\\Users\\RYZEN\\repos\\litmajor\\mtaa-dao"  # Change to your target directory path
ALLOWED_EXTENSIONS = {'.py', '.js', '.ts', '.html', '.css', '.go', '.rs'} 

# 2. Bundle the codebase into a structured prompt context
def bundle_codebase(directory):
    bundled_text = "Here is my codebase for context:\n\n"
    
    for root, dirs, files in os.walk(directory):
        # Skip common dependency/metadata folders
        if any(ignored in root for ignored in ['node_modules', '.git', '__pycache__', 'venv', 'env']):
            continue
            
        for file in files:
            ext = os.path.splitext(file)[1]
            if ext in ALLOWED_EXTENSIONS:
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    # Create a clear boundary for each file
                    relative_path = os.path.relpath(file_path, directory)
                    bundled_text += f"--- FILE: {relative_path} ---\n"
                    bundled_text += f"""```\n{content}\n```"""
                    bundled_text += "\n\n"
                except Exception as e:
                    bundled_text += f"--- ERROR READING {relative_path}: {e} ---\n\n"
    return bundled_text


# 3. Example Usage
if __name__ == "__main__":
    # Replace with your actual API key
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

    # Example: point to the current directory
    current_directory_codebase = bundle_codebase('.') 
    print(current_directory_codebase)

    # To use with the Gemini API (uncomment and replace with your actual model)
     model = genai.GenerativeModel('gemini-pro')
     chat = model.start_chat()
    response = chat.send_message(current_directory_codebase + "\n\nNow, please summarize this codebase for me.")
    print(response.text)
