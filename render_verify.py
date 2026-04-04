import fitz
doc = fitz.open("public/verify_output.pdf")
page = doc.load_page(0)
pix = page.get_pixmap(dpi=150)
pix.save("public/filled_form_verify.png")
print("Saved filled_form_verify.png")
