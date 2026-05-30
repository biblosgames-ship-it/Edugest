import sys

try:
    import pypdf
    reader = pypdf.PdfReader('./public/REGISTRO_SECUNDARIA_1_2024.pdf')
    text = ""
    for i, page in enumerate(reader.pages):
        t = page.extract_text()
        if t:
            text += f"--- PAGE {i+1} ---\n" + t + "\n"
    print(text[:3000])
except ImportError:
    print("pypdf not installed. Trying to read directly or checking plain text strings...")
    # let's try reading uncompressed streams if possible, or just notify
