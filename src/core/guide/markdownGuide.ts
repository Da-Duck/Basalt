import type { Language } from '../i18n/i18n';

export function getMarkdownGuideHtml(lang: Language): string {
  if (lang === 'en') {
    return `
      <div class="guide-container">
        <section class="guide-section">
          <h4>1. Headings</h4>
          <p class="guide-desc">Use <code>#</code> symbols followed by a space to create headings.</p>
          <div class="guide-code-box">
            <code># Heading 1 (Document Title)<br/>## Heading 2 (Main Section)<br/>### Heading 3 (Subsection)<br/>#### Heading 4</code>
          </div>
        </section>

        <section class="guide-section">
          <h4>2. Text Formatting</h4>
          <div class="guide-code-box">
            <code>**Bold text** &nbsp;➔&nbsp; <strong>Bold text</strong><br/>
            *Italic text* &nbsp;➔&nbsp; <em>Italic text</em><br/>
            ~~Strikethrough~~ &nbsp;➔&nbsp; <del>Strikethrough</del><br/>
            ==Highlight text== &nbsp;➔&nbsp; <mark>Highlight text</mark></code>
          </div>
        </section>

        <section class="guide-section">
          <h4>3. Task Lists & Checkboxes</h4>
          <p class="guide-desc">Create interactive task lists with brackets:</p>
          <div class="guide-code-box">
            <code>- [ ] Task to do<br/>- [x] Completed task</code>
          </div>
        </section>

        <section class="guide-section">
          <h4>4. Bulleted & Numbered Lists</h4>
          <div class="guide-code-box">
            <code>- First item<br/>- Second item<br/>&nbsp;&nbsp;- Indented sub-item<br/><br/>
            1. Step one<br/>2. Step two<br/>3. Step three</code>
          </div>
        </section>

        <section class="guide-section">
          <h4>5. Blockquotes</h4>
          <div class="guide-code-box">
            <code>> Knowledge is of no value unless you put it into practice.<br/>> — Anton Chekhov</code>
          </div>
        </section>

        <section class="guide-section">
          <h4>6. Code & Monospace</h4>
          <p class="guide-desc">Inline code with backticks or multi-line blocks with triple backticks:</p>
          <div class="guide-code-box">
            <code>Use \`const x = 42;\` inline.<br/><br/>
            \`\`\`typescript<br/>
            function greet(name: string): string {<br/>
            &nbsp;&nbsp;return \`Hello, \${name}!\`;<br/>
            }<br/>
            \`\`\`</code>
          </div>
        </section>

        <section class="guide-section">
          <h4>7. Links, Notes & Images</h4>
          <p class="guide-desc">Create external links, inter-note links (WikiLinks), and embed images:</p>
          <div class="guide-code-box">
            <code>[Basalt GitHub Repository](https://github.com/Da-Duck/Basalt)<br/>
            [[Other Note Name]] &nbsp;➔&nbsp; Link to another note<br/>
            [[Folder/Note|Custom Title]] &nbsp;➔&nbsp; Note link with custom text<br/>
            [Link to note](Other Note.md)<br/>
            ![Image description](https://example.com/photo.jpg)</code>
          </div>
        </section>

        <section class="guide-section">
          <h4>8. Tables</h4>
          <div class="guide-code-box">
            <code>| Feature | Status | Notes |<br/>
            |---|---|---|<br/>
            | Markdown Editor | Ready | CodeMirror 6 |<br/>
            | Free Cloud Sync | In Progress | WebDAV / Drive |</code>
          </div>
        </section>

        <section class="guide-section">
          <h4>9. Keyboard Shortcuts</h4>
          <div class="guide-code-box">
            <code><strong>Ctrl + S</strong> : Instant manual save<br/>
            <strong>Ctrl + Z</strong> : Undo last change<br/>
            <strong>Ctrl + Y</strong> / <strong>Ctrl + Shift + Z</strong> : Redo change</code>
          </div>
        </section>
      </div>
    `;
  }

  // Русский язык
  return `
    <div class="guide-container">
      <section class="guide-section">
        <h4>1. Заголовки</h4>
        <p class="guide-desc">Используйте символ <code>#</code> с последующим пробелом для уровней заголовков.</p>
        <div class="guide-code-box">
          <code># Заголовок 1 уровня (Название заметки)<br/>## Заголовок 2 уровня (Основной раздел)<br/>### Заголовок 3 уровня (Подраздел)<br/>#### Заголовок 4 уровня</code>
        </div>
      </section>

      <section class="guide-section">
        <h4>2. Форматирование текста</h4>
        <div class="guide-code-box">
          <code>**Полужирный текст** &nbsp;➔&nbsp; <strong>Полужирный текст</strong><br/>
          *Курсив* &nbsp;➔&nbsp; <em>Курсив</em><br/>
          ~~Зачёркнутый текст~~ &nbsp;➔&nbsp; <del>Зачёркнутый текст</del><br/>
          ==Выделение маркером== &nbsp;➔&nbsp; <mark>Выделение маркером</mark></code>
        </div>
      </section>

      <section class="guide-section">
        <h4>3. Списки задач и чекбоксы</h4>
        <p class="guide-desc">Создавайте интерактивные списки задач с помощью квадратных скобок:</p>
        <div class="guide-code-box">
          <code>- [ ] Задача к выполнению<br/>- [x] Выполненная задача</code>
        </div>
      </section>

      <section class="guide-section">
        <h4>4. Списки (Маркированные и нумерованные)</h4>
        <div class="guide-code-box">
          <code>- Первый пункт<br/>- Второй пункт<br/>&nbsp;&nbsp;- Вложенный пункт с отступом<br/><br/>
          1. Первый шаг<br/>2. Второй шаг<br/>3. Третий шаг</code>
        </div>
      </section>

      <section class="guide-section">
        <h4>5. Цитаты и заметки</h4>
        <div class="guide-code-box">
          <code>> Знания имеют ценность только тогда, когда применяются на практике.<br/>> — Антон Чехов</code>
        </div>
      </section>

      <section class="guide-section">
        <h4>6. Код и моноширинный текст</h4>
        <p class="guide-desc">Инлайн-код обрамляется одиночными обратными кавычками, многострочные блоки — тройными:</p>
        <div class="guide-code-box">
          <code>Используйте \`const note = "Basalt";\` в тексте.<br/><br/>
          \`\`\`typescript<br/>
          function greet(name: string): string {<br/>
          &nbsp;&nbsp;return \`Привет, \${name}!\`;<br/>
          }<br/>
          \`\`\`</code>
        </div>
      </section>

      <section class="guide-section">
        <h4>7. Ссылки, переход между заметками и картинки</h4>
        <p class="guide-desc">Создавайте ссылки на сайты, перекрёстные ссылки между заметками (WikiLinks) и вставляйте изображения:</p>
        <div class="guide-code-box">
          <code>[Репозиторий Basalt на GitHub](https://github.com/Da-Duck/Basalt)<br/>
          [[Другая заметка]] &nbsp;➔&nbsp; Переход к другой заметке<br/>
          [[Папка/Заметка|Свой текст]] &nbsp;➔&nbsp; Ссылка на заметку со своим текстом<br/>
          [Текст ссылки](Другая заметка.md)<br/>
          ![Описание картинки](https://example.com/photo.jpg)</code>
        </div>
      </section>

      <section class="guide-section">
        <h4>8. Таблицы</h4>
        <div class="guide-code-box">
          <code>| Функция | Статус | Примечание |<br/>
          |---|---|---|<br/>
          | Редактор заметок | Готово | CodeMirror 6 |<br/>
          | Бесплатный синк | В разработке | WebDAV / Drive |</code>
        </div>
      </section>

      <section class="guide-section">
        <h4>9. Горячие клавиши редактора</h4>
        <div class="guide-code-box">
          <code><strong>Ctrl + S</strong> : Принудительное сохранение<br/>
          <strong>Ctrl + Z</strong> : Отменить действие (Undo)<br/>
          <strong>Ctrl + Y</strong> / <strong>Ctrl + Shift + Z</strong> : Повторить действие (Redo)</code>
        </div>
      </section>
    </div>
  `;
}
