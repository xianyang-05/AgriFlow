const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function run() {
  const pdfBytes = fs.readFileSync('public/Borang-Cadangan-v13092024.pdf');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  if (fields.length === 0) {
    console.log("No form fields found in the PDF. It might be a flat PDF.");
  } else {
    fields.forEach(field => {
      const type = field.constructor.name;
      const name = field.getName();
      console.log(`${type}: ${name}`);
    });
  }
}

run().catch(err => console.error(err));
