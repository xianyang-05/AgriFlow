import fitz  # PyMuPDF
doc = fitz.open("public/Borang-Cadangan-v13092024.pdf")
page = doc.load_page(0)  # first page
pix = page.get_pixmap(dpi=150)
pix.save("public/form_preview.png")
