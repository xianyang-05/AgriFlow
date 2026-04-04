import fitz  # PyMuPDF
doc = fitz.open("public/Borang-Cadangan-v13092024.pdf")
page = doc.load_page(1)  # second page
pix = page.get_pixmap(dpi=150)
pix.save("public/form_preview_2.png")
