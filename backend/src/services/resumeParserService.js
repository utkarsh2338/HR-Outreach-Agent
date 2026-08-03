import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extracts plain text from a resume buffer (PDF or DOCX).
 *
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - File mime type or extension hint
 * @param {string} fileName - Original file name
 * @returns {Promise<string>} Extracted plain text
 */
export const parseResumeBuffer = async (buffer, mimeType, fileName = '') => {
  if (!buffer || buffer.length === 0) {
    throw new Error('File buffer is empty');
  }

  const isPdf =
    mimeType === 'application/pdf' ||
    fileName.toLowerCase().endsWith('.pdf');

  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    fileName.toLowerCase().endsWith('.docx') ||
    fileName.toLowerCase().endsWith('.doc');

  if (isPdf) {
    try {
      const data = await pdfParse(buffer);
      const extractedText = data.text ? data.text.trim() : '';
      if (!extractedText) {
        throw new Error('PDF file appears to be empty or contains no selectable text (scanned PDF).');
      }
      return extractedText;
    } catch (err) {
      throw new Error(`Failed to parse PDF file: ${err.message}`);
    }
  }

  if (isDocx) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const extractedText = result.value ? result.value.trim() : '';
      if (!extractedText) {
        throw new Error('DOCX file appears to be empty or contains no text.');
      }
      return extractedText;
    } catch (err) {
      throw new Error(`Failed to parse DOCX file: ${err.message}`);
    }
  }

  throw new Error('Unsupported file format. Please upload a PDF (.pdf) or Word document (.docx).');
};
