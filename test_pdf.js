const fs = require('fs');
const { PDFDocument, rgb } = require('pdf-lib');

async function testPdf() {
  try {
    const pdfBytes = fs.readFileSync('public/Borang-Cadangan-v13092024.pdf');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    
    firstPage.drawText("Ahmad Bin Ali", { x: 240, y: 792 - 384, size: 10, color: rgb(0,0,0) });
    
    const finalBytes = await pdfDoc.save();
    fs.writeFileSync('public/test_output.pdf', finalBytes);
    console.log("Wrote test_output.pdf! Size:", finalBytes.length);
  } catch (err) {
    console.error("Error creating pdf:", err);
  }
}

testPdf();
