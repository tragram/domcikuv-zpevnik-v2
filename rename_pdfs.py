import glob
import os

import unidecode

# Example normalize_string function (customize as needed)

def normalize_string(input_str):
    """Convert a string to ASCII and replace spaces with underscores."""
    # Convert to closest ASCII representation using unidecode
    ascii_str = unidecode.unidecode(input_str)
    # delete any non-alphanumeric characters
    # Replace spaces with underscores
    ascii_str = ascii_str.replace(" ", "_").replace("'","").replace("._","_")
    return ascii_str

# Function to rename PDF files in a directory
def rename_pdfs_in_directory(directory):
    # Search for all PDF files in the given directory
    pdf_files = glob.glob(os.path.join(directory, "*.pdf"))
    
    for file_path in pdf_files:
        # Get the base name (without the directory)
        base_name = os.path.basename(file_path)
        
        # Extract the file name without the extension
        file_name, file_ext = os.path.splitext(base_name)
        
        # Normalize the file name
        normalized_name = normalize_string(file_name)
        
        # Construct the new file path
        new_file_path = os.path.join(directory, normalized_name + file_ext)
        
        # Rename the file
        os.rename(file_path, new_file_path)
        print(f"Renamed: {file_path} -> {new_file_path}")

directory_path = "songs/pdfs"
rename_pdfs_in_directory(directory_path)
