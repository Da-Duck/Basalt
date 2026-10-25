import { t } from '../i18n/i18n';

export class MarkdownRenderer {
  /**
   * Экранирование спецсимволов HTML
   */
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Парсинг инлайн-элементов (код, ссылки, выделение, жирный, курсив, зачеркивание)
   */
  public static renderInline(text: string): string {
    // 1. Защита инлайн-кода `code`
    const codePlaceholders: string[] = [];
    let processed = text.replace(/`([^`]+)`/g, (_, code) => {
      const placeholder = `%%CODE_INLINE_${codePlaceholders.length}%%`;
      codePlaceholders.push(`<code class="inline-code">${this.escapeHtml(code)}</code>`);
      return placeholder;
    });

    // 2. Картинки: ![alt](url)
    processed = processed.replace(/!\[(.*?)\]\((.*?)\)/g, (_, alt, url) => {
      const cleanUrl = this.escapeHtml(url.trim());
      const cleanAlt = this.escapeHtml(alt.trim());
      return `<img src="${cleanUrl}" alt="${cleanAlt}" class="md-rendered-image" loading="lazy" />`;
    });

    // 3. WikiLinks: [[Target|Label]] или [[Target]]
    processed = processed.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (_, target, label) => {
      const cleanTarget = target.trim();
      const displayLabel = label ? label.trim() : cleanTarget;
      return `<a href="javascript:void(0)" class="internal-link" data-internal-target="${this.escapeHtml(cleanTarget)}" title="Открыть заметку: ${this.escapeHtml(cleanTarget)}"><span class="internal-link-icon">📄</span><span class="internal-link-text">${this.escapeHtml(displayLabel)}</span></a>`;
    });

    // 4. Обычные Markdown-ссылки: [text](url)
    processed = processed.replace(/\[(.*?)\]\((.*?)\)/g, (_, label, url) => {
      const cleanUrl = url.trim();
      const cleanLabel = label.trim();

      // Внешняя веб-ссылка
      if (/^(https?:\/\/|mailto:|tel:)/i.test(cleanUrl)) {
        return `<a href="${this.escapeHtml(cleanUrl)}" target="_blank" rel="noopener noreferrer" class="external-link">${cleanLabel} <span class="external-arrow">↗</span></a>`;
      }

      // Внутренняя ссылка на другую заметку
      return `<a href="javascript:void(0)" class="internal-link" data-internal-target="${this.escapeHtml(cleanUrl)}" title="Открыть заметку: ${this.escapeHtml(cleanUrl)}"><span class="internal-link-icon">📄</span><span class="internal-link-text">${cleanLabel}</span></a>`;
    });

    // 5. Выделение маркером: ==highlight==
    processed = processed.replace(/==(.*?)==/g, '<mark class="md-highlight">$1</mark>');

    // 6. Полужирный: **text** или __text__
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // 7. Зачёркнутый: ~~text~~
    processed = processed.replace(/~~(.*?)~~/g, '<del class="md-del">$1</del>');

    // 8. Курсив: *text* или _text_
    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');

    // 9. Восстановление инлайн-кода
    codePlaceholders.forEach((codeHtml, idx) => {
      processed = processed.replace(`%%CODE_INLINE_${idx}%%`, codeHtml);
    });

    return processed;
  }

  /**
   * Преобразование полного Markdown-документа в интерактивный HTML
   */
  public static renderDocument(markdown: string): string {
    if (!markdown || !markdown.trim()) {
      return `<div class="preview-empty-hint"><p>${t('emptyPreviewText')}</p></div>`;
    }

    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const output: string[] = [];

    let inCodeBlock = false;
    let codeLanguage = '';
    let codeBuffer: string[] = [];

    let inTable = false;
    let tableHeaders: string[] = [];
    let tableAlignments: Array<'left' | 'center' | 'right'> = [];
    let tableRows: string[][] = [];

    let inBlockquote = false;
    let blockquoteBuffer: string[] = [];

    let inList = false;
    let listType: 'ul' | 'ol' | 'task' = 'ul';

    const flushTable = () => {
      if (!inTable) return;
      let html = '<div class="table-responsive"><table class="md-table"><thead><tr>';
      tableHeaders.forEach((th, idx) => {
        const align = tableAlignments[idx] || 'left';
        html += `<th style="text-align: ${align};">${this.renderInline(th)}</th>`;
      });
      html += '</tr></thead><tbody>';
      tableRows.forEach((row) => {
        html += '<tr>';
        tableHeaders.forEach((_, idx) => {
          const val = row[idx] !== undefined ? row[idx] : '';
          const align = tableAlignments[idx] || 'left';
          html += `<td style="text-align: ${align};">${this.renderInline(val)}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      output.push(html);

      inTable = false;
      tableHeaders = [];
      tableAlignments = [];
      tableRows = [];
    };

    const flushBlockquote = () => {
      if (!inBlockquote) return;
      const innerMd = blockquoteBuffer.join('\n');
      output.push(`<blockquote class="md-blockquote">${this.renderDocument(innerMd)}</blockquote>`);
      inBlockquote = false;
      blockquoteBuffer = [];
    };

    const flushList = () => {
      if (!inList) return;
      if (listType === 'ol') {
        output.push('</ol>');
      } else if (listType === 'task') {
        output.push('</ul>');
      } else {
        output.push('</ul>');
      }
      inList = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 1. Блоки кода ```lang
      if (trimmed.startsWith('```')) {
        if (!inCodeBlock) {
          flushTable();
          flushBlockquote();
          flushList();
          inCodeBlock = true;
          codeLanguage = trimmed.slice(3).trim();
          codeBuffer = [];
        } else {
          inCodeBlock = false;
          const escapedCode = this.escapeHtml(codeBuffer.join('\n'));
          const langBadge = codeLanguage ? `<span class="code-lang-tag">${this.escapeHtml(codeLanguage)}</span>` : '';
          output.push(`
            <div class="code-block-container">
              ${langBadge}
              <pre><code class="code-content language-${this.escapeHtml(codeLanguage)}">${escapedCode}</code></pre>
            </div>
          `);
          codeBuffer = [];
          codeLanguage = '';
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // 2. Цитаты > Quote
      if (trimmed.startsWith('>')) {
        flushTable();
        flushList();
        inBlockquote = true;
        blockquoteBuffer.push(trimmed.replace(/^>\s?/, ''));
        continue;
      } else if (inBlockquote) {
        flushBlockquote();
      }

      // 3. Таблицы | Col 1 | Col 2 |
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
        // Проверяем строку разделителя (|---|---|)
        if (!inTable) {
          const nextLine = lines[i + 1]?.trim();
          if (nextLine && nextLine.startsWith('|') && nextLine.includes('---')) {
            flushList();
            inTable = true;
            tableHeaders = trimmed
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim());

            // Читаем разделитель и выравнивания
            const sepCols = nextLine.slice(1, -1).split('|');
            tableAlignments = sepCols.map((c) => {
              const col = c.trim();
              if (col.startsWith(':') && col.endsWith(':')) return 'center';
              if (col.endsWith(':')) return 'right';
              return 'left';
            });

            i++; // Пропускаем строку разделителя
            continue;
          }
        } else {
          const rowCells = trimmed
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
          tableRows.push(rowCells);
          continue;
        }
      } else if (inTable) {
        flushTable();
      }

      // Пустая строка — закрываем списки и блоки
      if (!trimmed) {
        flushList();
        continue;
      }

      // 4. Горизонтальная линия
      if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flushList();
        output.push('<hr class="md-hr" />');
        continue;
      }

      // 5. Заголовки (H1 — H6)
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushList();
        const level = headingMatch[1].length;
        const headingText = this.renderInline(headingMatch[2]);
        output.push(`<h${level} class="md-h md-h${level}">${headingText}</h${level}>`);
        continue;
      }

      // 6. Интерактивные задачи (Чекбоксы: - [ ] или - [x])
      const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);
      if (taskMatch) {
        if (!inList || listType !== 'task') {
          flushList();
          inList = true;
          listType = 'task';
          output.push('<ul class="md-task-list">');
        }

        const isChecked = taskMatch[2].toLowerCase() === 'x';
        const taskText = this.renderInline(taskMatch[3]);
        output.push(`
          <li class="md-task-item ${isChecked ? 'completed' : ''}">
            <label class="md-task-label">
              <input type="checkbox" class="md-task-checkbox" data-line-index="${i}" ${isChecked ? 'checked' : ''} />
              <span class="md-task-text">${taskText}</span>
            </label>
          </li>
        `);
        continue;
      }

      // 7. Нумерованные списки (1. Item)
      const numMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (numMatch) {
        if (!inList || listType !== 'ol') {
          flushList();
          inList = true;
          listType = 'ol';
          output.push('<ol class="md-ordered-list">');
        }
        output.push(`<li>${this.renderInline(numMatch[2])}</li>`);
        continue;
      }

      // 8. Маркированные списки (- Item или * Item)
      const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
          output.push('<ul class="md-bullet-list">');
        }
        output.push(`<li>${this.renderInline(bulletMatch[2])}</li>`);
        continue;
      }

      // 9. Обычный абзац текста
      flushList();
      output.push(`<p class="md-p">${this.renderInline(line)}</p>`);
    }

    // Сброс незакрытых элементов в конце документа
    if (inCodeBlock) {
      const escapedCode = this.escapeHtml(codeBuffer.join('\n'));
      output.push(`<pre><code class="code-content">${escapedCode}</code></pre>`);
    }
    flushTable();
    flushBlockquote();
    flushList();

    return output.join('\n');
  }
}
