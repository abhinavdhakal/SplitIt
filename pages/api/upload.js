import formidable from "formidable";
import fs from "fs";
import pdf from "pdf-parse";
import { pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

// Disable Next.js body parser (needed for file uploads)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Parse incoming form with PDF
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Form parsing failed" });
    }

    try {
      const file = files.file[0]; // Grab uploaded file
      const dataBuffer = fs.readFileSync(file.filepath);

      const pdfData = await pdf(dataBuffer);

      res.status(200).json({
        text: pdfData.text, // full text
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "PDF parsing failed" });
    }
  });
}
