import fitz

doc = fitz.open("public/Borang-Cadangan-v13092024.pdf")
page = doc.load_page(0)

phrases = [
    "Nama Penuh Pencadang",
    "No. Kad Pengenalan",
    "No. Telefon",
    "Alamat Surat Menyurat"
]

with open("coords.txt", "w", encoding="utf-8") as f:
    f.write(f"Page size: {page.rect.width}, {page.rect.height}\n")
    for p in phrases:
        rects = page.search_for(p)
        if rects:
            f.write(f"'{p}' found at: {rects[0]}\n")
        else:
            f.write(f"'{p}' not found!\n")
