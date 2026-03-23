import sys
import os

print("--- Python Environment Check ---")
print(f"Python Executable Path: {sys.executable}")
print(f"Current Working Directory: {os.getcwd()}")
print("-" * 30)

script_to_check = 'process_papers.py'
script_path = os.path.join(os.getcwd(), script_to_check)

print(f"Checking for script at: {script_path}")

if os.path.exists(script_path):
    print("✅ Script found.")
    print("\n--- Reading the critical function from the file on disk ---")
    try:
        with open(script_path, 'r') as f:
            lines = f.readlines()

        found_function = False
        for i, line in enumerate(lines):
            if "def ocr_image_with_p2t" in line:
                # Print the function definition and the 6 lines that follow it
                print("".join(lines[i:i+7]))
                found_function = True
                break

        if not found_function:
            print("ERROR: Could not find the function 'ocr_image_with_p2t' in the file.")

    except Exception as e:
        print(f"Could not read the file: {e}")
else:
    print(f"❌ ERROR: Could not find '{script_to_check}' in the current directory.")

print("\n--- End of Check ---")