/**
 * Safe HTML Sanitizer for user-provided subjective essay answers.
 * Strips executable scripts, event handlers, and unsafe attributes.
 */
export const sanitizeHtml = (dirtyHtml) => {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

  try {
    const doc = new DOMParser().parseFromString(dirtyHtml, 'text/html');

    // Remove high-risk elements
    const blockedTags = [
      'script',
      'iframe',
      'object',
      'embed',
      'link',
      'style',
      'base',
      'meta',
      'form',
      'button',
      'input',
    ];
    blockedTags.forEach((tag) => {
      const elements = doc.querySelectorAll(tag);
      elements.forEach((el) => el.remove());
    });

    // Remove event handlers and javascript: / data: URLs
    const allElements = doc.querySelectorAll('*');
    allElements.forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const val = attr.value.toLowerCase().replace(/\s+/g, '');
        if (
          name.startsWith('on') ||
          val.startsWith('javascript:') ||
          val.startsWith('data:text/html') ||
          val.startsWith('vbscript:')
        ) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return doc.body.innerHTML;
  } catch (err) {
    console.error('HTML sanitize error:', err);
    return '';
  }
};

export default sanitizeHtml;
