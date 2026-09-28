const logger = require('../utils/logger');

class GoogleFormsService {
  /**
   * Extract clean Google Form ID from raw URL or ID
   */
  extractFormId(urlOrId) {
    if (!urlOrId || typeof urlOrId !== 'string') {
      return null;
    }

    const trimmed = urlOrId.trim();
    // Match docs.google.com/forms/d/e/ID/viewform or docs.google.com/forms/d/ID/edit
    const urlMatch = trimmed.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // If already an alphanumeric ID
    if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
      return trimmed;
    }

    return null;
  }

  /**
   * Fetch form structure from official Google Forms API or structured payload
   */
  async fetchForm(formIdOrUrl, options = {}) {
    // If structured formData object passed directly (e.g. via direct export or in tests)
    if (typeof formIdOrUrl === 'object' && formIdOrUrl !== null) {
      return formIdOrUrl;
    }

    const formId = this.extractFormId(formIdOrUrl);
    if (!formId) {
      const err = new Error('Invalid Google Forms URL or Form ID. Expected a valid Google Form reference.');
      err.statusCode = 400;
      throw err;
    }

    const accessToken = options.accessToken || process.env.GOOGLE_FORMS_ACCESS_TOKEN;
    const apiKey = options.apiKey || process.env.GOOGLE_FORMS_API_KEY;

    // Call official Google Forms REST API
    let apiUrl = `https://forms.googleapis.com/v1/forms/${formId}`;
    if (!accessToken && apiKey) {
      apiUrl += `?key=${apiKey}`;
    }

    const headers = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
      logger.info('google_forms_fetch_started', { formId });
      const res = await fetch(apiUrl, { headers });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const errMessage = errBody?.error?.message || `Google Forms API returned HTTP ${res.status}`;
        const err = new Error(`Google Forms import error: ${errMessage}`);
        err.statusCode = res.status === 401 || res.status === 403 ? 403 : 400;
        throw err;
      }

      const data = await res.json();
      return data;
    } catch (err) {
      if (err.statusCode) throw err;
      logger.warn('google_forms_fetch_failed', { formId, error: err.message });
      const error = new Error(`Failed to access Google Form: ${err.message}. Ensure the form is shared and authorized.`);
      error.statusCode = 400;
      throw error;
    }
  }

  /**
   * Alias for normalizeGoogleForm returning questions array
   */
  async parseGoogleFormResponse(formData) {
    const result = this.normalizeGoogleForm(formData);
    return result.questions || [];
  }

  /**
   * Normalize Google Forms API items into UAP question objects
   */
  normalizeGoogleForm(formData) {
    if (!formData || !Array.isArray(formData.items)) {
      throw new Error('Malformed Google Forms data: Missing "items" array.');
    }

    const questions = [];
    let counter = 1;

    for (const item of formData.items) {
      // Handle question item
      if (item.questionItem && item.questionItem.question) {
        const q = item.questionItem.question;
        const prompt = (item.title || q.questionText || '').trim();
        if (!prompt) continue;

        let type = 'short_answer';
        const options = [];
        let isUnsupported = false;
        let unsupportedReason = null;

        if (q.choiceQuestion) {
          type = 'mcq';
          const choiceOptions = q.choiceQuestion.options || [];
          choiceOptions.forEach((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            options.push({
              id: letter,
              text: (opt.value || `Option ${letter}`).trim(),
            });
          });
        } else if (q.textQuestion) {
          if (q.textQuestion.paragraph) {
            type = 'long_answer';
          } else {
            type = 'short_answer';
          }
        } else if (q.fileUploadQuestion) {
          type = 'file_upload';
        } else {
          // Unsupported structure (scale, grid, date, etc.)
          isUnsupported = true;
          const detectedKind = Object.keys(q).find((k) => k.endsWith('Question')) || 'complexQuestion';
          unsupportedReason = `Unsupported Google Form question format: ${detectedKind}. Please review and adjust.`;
          type = 'short_answer';
        }

        questions.push({
          tempId: `gform_${Date.now()}_${counter++}`,
          questionText: prompt,
          type,
          options,
          correctAnswer: options.length > 0 ? options[0].id : null,
          explanation: item.description || null,
          points: q.grading?.pointValue || 5,
          isUnsupported,
          unsupportedReason,
          rawItem: item,
        });
      } else if (item.questionGroupItem && Array.isArray(item.questionGroupItem.questions)) {
        // Unpack question group items
        for (const subQ of item.questionGroupItem.questions) {
          const prompt = `${item.title ? item.title + ' - ' : ''}${subQ.questionText || ''}`.trim();
          questions.push({
            tempId: `gform_${Date.now()}_${counter++}`,
            questionText: prompt || 'Group Question',
            type: 'short_answer',
            options: [],
            correctAnswer: null,
            explanation: null,
            points: 5,
            isUnsupported: false,
            unsupportedReason: null,
          });
        }
      }
    }

    return {
      title: formData.info?.title || 'Imported Google Form',
      description: formData.info?.description || '',
      questions,
    };
  }
}

module.exports = new GoogleFormsService();
