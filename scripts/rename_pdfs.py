import glob
import os

from utils import normalize_string, songs_path


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


directory_path = songs_path() / "pdfs"
rename_pdfs_in_directory(directory_path)
