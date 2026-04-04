import fitz

doc = fitz.open("public/Borang-Cadangan-v13092024.pdf")
page = doc.load_page(0)

phrases = [
    "Nama Penuh Pencadang",
    "No. Kad Pengenalan",
    "No. Telefon",
    "Alamat Surat Menyurat"
]

print(f"Page size (width, height): {page.rect.width}, {page.rect.height}")
for p in phrases:
    rects = page.search_for(p)
    if rects:
        # PyMuPDF coords: (x0, y0, x1, y1) where (0,0) is top-left
        print(f"'{p}' found at: {rects[0]}")
    else:
        print(f"'{p}' not found!")
