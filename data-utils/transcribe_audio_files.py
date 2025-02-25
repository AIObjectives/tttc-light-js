"""
Audio Transcription with the Whisper API

This script transcribes any number of audio files, storing their contents and 
the file they originated from in a CSV.

Files in the CSV produced:
- "name": filename of audio file, with extension removed
- "transcription": full transcription of audio file

Setup:
- create a single folder with all audio files for intended transcription
- make sure all audio files have names you'll recognize for looking up their
transcriptions
- have your OpenAI key handy

This script takes no command-line args.

"""

import os
import csv
import openai

def transcribe_audio(audio_filepath, api_key):
    """
    Transcribes an audio file using OpenAI's Whisper API. Returns full text 
    transcription of audio file.
    """
    print('about to transcribe ', audio_filepath)
    client = openai.OpenAI(api_key=api_key)
    with open(audio_filepath, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file
        )

    print(f"Transcribed {audio_filepath}")
    return response.text

if __name__ == "__main__":
    folder_name = input("Enter the name of a folder of audio files (from the current directory): ")
    output_filename = input("Enter a name for the transcription file (must end in .csv): ")
    api_key = input("Enter your OpenAI API key: ")

    audio_filetypes = ('.wav', '.mp3', '.flac', '.m4a')
    transcriptions = {}
    
    try:
        for file_name in os.listdir(folder_name):
            if file_name.endswith(audio_filetypes):
                file_path = os.path.join(folder_name, file_name)
                transcriptions[file_name] = transcribe_audio(file_path, api_key)

        with open(output_filename, "w") as out_f:
            writer = csv.writer(out_f)
            writer.writerow(["name", "transcription"])

            filename_base = os.path.splitext(file_name)[0]
            for file_name, transcription in transcriptions.items():
                writer.writerow([filename_base, transcription])
        
        print(f"All transcriptions saved to {output_filename}")

    except Exception as e:
        print("Error:", e)
