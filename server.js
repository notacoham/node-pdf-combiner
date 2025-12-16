const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = 3000;

app.use(express.static('public'));

app.post('/merge', upload.array('pdfs'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send('No files uploaded.');
    }

    const mergedPdf = await PDFDocument.create();

    for (const file of req.files) {
      // Check for PDF extension or mime type if strictly needed, 
      // but we'll assume valid input or try/catch load failure
      if (file.mimetype !== 'application/pdf') continue;

      try {
        const pdf = await PDFDocument.load(file.buffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        console.error(`Error loading file ${file.originalname}:`, err);
        // Continue with other files or fail? Let's generic fail for now if important
      }
    }

    const pdfBytes = await mergedPdf.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error(error);
    res.status(500).send('Error merging PDFs');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
