const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const logger = require('../utils/logger');

class QuestionParserService {
  /**
   * Extract raw text from file buffer based on extension/type
   */
  async extractTextFromFile(buffer, filename = '') {
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty file buffer provided for question extraction');
    }

    const lowerName = filename.toLowerCase();

    if (lowerName.endsWith('.pdf')) {
      const data = await pdfParse(buffer);
      return data.text || '';
    }

    if (lowerName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    if (lowerName.endsWith('.doc')) {
      // For older binary .doc format, extract ASCII/UTF-8 readable text segments
      const text = buffer.toString('utf8');
      const cleanText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ');
      if (cleanText.length < 20) {
        throw new Error('Unable to extract meaningful text from binary .doc file. Please convert to .docx or .pdf.');
      }
      return cleanText;
    }

    // Default: try utf-8 text
    return buffer.toString('utf8');
  }

  /**
   * Alias for parseTextToQuestions
   */
  async parseFromRawText(rawText, filename = '') {
    return this.parseTextToQuestions(rawText);
  }

  /**
   * Parse extracted raw text into structured question candidates
   */
  parseTextToQuestions(rawText) {
    if (!rawText || rawText.trim().length === 0) {
      return [];
    }

    // Normalize newlines
    const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split text into potential question blocks by question numbering patterns:
    // e.g., "1.", "Question 1:", "Q1.", "1)", "Q1:"
    const questionHeaderRegex = /(?:^|\n)\s*(?:Question\s*\d+[:.]?|Q\d+[:.)]?|\d+[.)])\s+/gi;

    const indices = [];
    let match;
    while ((match = questionHeaderRegex.exec(text)) !== null) {
      indices.push({
        index: match.index,
        header: match[0],
      });
    }

    const rawBlocks = [];
    if (indices.length > 0) {
      for (let i = 0; i < indices.length; i++) {
        const start = indices[i].index;
        const end = i < indices.length - 1 ? indices[i + 1].index : text.length;
        rawBlocks.push(text.slice(start, end).trim());
      }
    } else {
      // Fallback: split by double newlines if no numbering found
      const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 10);
      rawBlocks.push(...paragraphs);
    }

    const questions = [];
    let counter = 1;

    for (const block of rawBlocks) {
      if (block.length < 5) continue;

      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      // Extract question prompt (remove leading numbers/Q prefixes)
      let firstLine = lines[0].replace(/^(?:Question\s*\d+[:.]?|Q\d+[:.)]?|\d+[.)])\s*/i, '').trim();
      let promptLines = [firstLine];

      const options = [];
      let correctAnswer = null;
      let explanation = null;
      let points = 5;

      // Option prefix regex: A., A), (A), [A], a., a), etc.
      const optionRegex = /^(?:\(?([A-Da-d1-4])\)?[.:\)\-\]]|\b([A-Da-d1-4])[.:\)\-\]])\s+(.*)$/;
      // Answer regex: Answer: B, Ans: C, Correct: A
      const answerRegex = /^(?:Answer|Ans|Correct\s*Answer|Key)[:\s]+([A-Da-d1-4]|true|false|.+)$/i;
      // Explanation regex
      const explanationRegex = /^(?:Explanation|Reason|Note)[:\s]+(.*)$/i;
      // Points regex: [5 pts], (5 marks), 10 points, Points: 10, Marks: 10
      const pointsRegex = /^(?:Points?|Marks?|Pts?)[:\s]+(\d+)|(?:\[|\()?\b(\d+)\s*(?:pts|points|marks)(?:\]|\))?/i;

      let readingOptions = false;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        const pMatch = line.match(pointsRegex);
        if (pMatch) {
          points = parseInt(pMatch[1] || pMatch[2], 10) || 5;
          continue;
        }

        const ansMatch = line.match(answerRegex);
        if (ansMatch) {
          correctAnswer = ansMatch[1].trim().toLowerCase();
          continue;
        }

        const expMatch = line.match(explanationRegex);
        if (expMatch) {
          explanation = expMatch[1].trim();
          continue;
        }

        const optMatch = line.match(optionRegex);
        if (optMatch) {
          readingOptions = true;
          const optLetter = (optMatch[1] || optMatch[2]).toLowerCase();
          const optText = optMatch[3].trim();
          options.push({
            id: optLetter,
            text: optText,
          });
          continue;
        }

        if (!readingOptions) {
          promptLines.push(line);
        } else {
          // If we were reading options and line doesn't match an option, it might be continuation or explanation
          if (options.length > 0 && !explanation) {
            options[options.length - 1].text += ' ' + line;
          }
        }
      }

      const fullPrompt = promptLines.join(' ').trim();
      if (!fullPrompt || fullPrompt.length < 3) continue;

      // Type detection
      let detectedType = 'short_answer';
      if (options.length >= 2) {
        detectedType = 'mcq';
      } else if (
        fullPrompt.length > 150 ||
        /\b(explain in detail|discuss|describe|critique|elaborate|write an essay)\b/i.test(fullPrompt)
      ) {
        detectedType = 'long_answer';
      }

      questions.push({
        tempId: `tmp_${Date.now()}_${counter++}`,
        questionText: fullPrompt,
        type: detectedType,
        options,
        correctAnswer: correctAnswer || (options.length > 0 ? options[0].id : null),
        explanation,
        points,
        rawBlock: block,
      });
    }

    return questions;
  }
}

module.exports = new QuestionParserService();
