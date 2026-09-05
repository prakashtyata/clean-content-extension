document.addEventListener('DOMContentLoaded', function () {
    // ===== DOM References =====
    const editor = document.getElementById('editor');
    const output = document.getElementById('output');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const addLinkBtn = document.getElementById('addLinkBtn');
    const removeLinkBtn = document.getElementById('removeLinkBtn');
    const copyAlert = document.getElementById('copyAlert');
    const darkModeBtn = document.getElementById('darkModeBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const previewToggle = document.getElementById('previewToggle');
    const previewArea = document.getElementById('previewArea');
    const formatIndicator = document.getElementById('formatIndicator');
    const wordCountEl = document.getElementById('wordCount');
    const charCountEl = document.getElementById('charCount');
    const linkCountEl = document.getElementById('linkCount');
    const paraCountEl = document.getElementById('paraCount');

    // Settings toggles
    const autoCopyToggle = document.getElementById('autoCopyToggle');
    const preserveImagesToggle = document.getElementById('preserveImagesToggle');
    const stripEmptyToggle = document.getElementById('stripEmptyToggle');
    const preserveHeadingsToggle = document.getElementById('preserveHeadingsToggle');
    const smartQuotesToggle = document.getElementById('smartQuotesToggle');
    const retainImageLinksToggle = document.getElementById('retainImageLinksToggle');

    // Toolbar buttons
    const commandBtns = document.querySelectorAll('.tool-btn[data-command]');
    const blockBtns = document.querySelectorAll('.tool-btn[data-block]');

    // ===== State =====
    let previewMode = false;
    let formatIndicatorTimeout = null;

    // ===== Load Settings =====
    loadSettings();
    editor.focus();

    // ===== TOOLBAR: Standard commands =====
    commandBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const command = btn.getAttribute('data-command');
            document.execCommand(command, false, null);
            editor.focus();
            updateOutput();
            showFormatIndicator(command);
            updateToolbarState();
        });
    });

    // ===== TOOLBAR: Block format =====
    blockBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const block = btn.getAttribute('data-block');
            document.execCommand('formatBlock', false, '<' + block + '>');
            editor.focus();
            updateOutput();
            showFormatIndicator(block.toUpperCase());
            updateToolbarState();
        });
    });

    // ===== Add Link =====
    addLinkBtn.addEventListener('click', () => {
        const selection = window.getSelection();
        if (!selection.toString().trim()) {
            showAlert('Select text first to add a link');
            return;
        }
        const url = prompt('Enter URL:', 'https://');
        if (url && url !== 'https://') {
            document.execCommand('createLink', false, url);
            editor.focus();
            updateOutput();
            showAlert('Link added!');
        }
    });

    // ===== Remove All Links =====
    removeLinkBtn.addEventListener('click', () => {
        const links = editor.querySelectorAll('a');
        if (links.length === 0) {
            showAlert('No links to remove');
            return;
        }
        links.forEach(link => {
            const text = document.createTextNode(link.textContent);
            link.parentNode.replaceChild(text, link);
        });
        editor.focus();
        updateOutput();
        showAlert(links.length + ' link' + (links.length > 1 ? 's' : '') + ' removed!');
    });

    // ===== Undo / Redo =====
    undoBtn.addEventListener('click', () => {
        document.execCommand('undo');
        editor.focus();
        updateOutput();
    });

    redoBtn.addEventListener('click', () => {
        document.execCommand('redo');
        editor.focus();
        updateOutput();
    });

    // ===== Clear =====
    clearBtn.addEventListener('click', () => {
        if (editor.innerHTML.trim() === '') return;
        editor.innerHTML = '';
        output.textContent = '';
        previewArea.innerHTML = '';
        updateStats();
        editor.focus();
        showAlert('Editor cleared');
    });

    // ===== Copy =====
    copyBtn.addEventListener('click', async () => {
        const text = output.textContent;
        if (!text) {
            showAlert('Nothing to copy');
            return;
        }
        await copyToClipboard(text);
        showAlert('Copied to clipboard!');

        // Visual feedback on button
        copyBtn.classList.add('copied');
        const origHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '✓ Copied!';
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = origHTML;
        }, 1500);
    });

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    }

    function showAlert(message) {
        const alertText = copyAlert.querySelector('.alert-text');
        if (alertText) alertText.textContent = message;
        copyAlert.classList.add('show');
        setTimeout(() => {
            copyAlert.classList.remove('show');
        }, 2200);
    }

    function showFormatIndicator(formatName) {
        if (formatIndicatorTimeout) clearTimeout(formatIndicatorTimeout);
        const labels = {
            'bold': 'Bold',
            'italic': 'Italic',
            'underline': 'Underline',
            'strikethrough': 'Strikethrough',
            'insertUnorderedList': 'Bullet List',
            'insertOrderedList': 'Numbered List',
            'H1': 'Heading 1',
            'H2': 'Heading 2',
            'H3': 'Heading 3',
            'BLOCKQUOTE': 'Blockquote',
            'P': 'Paragraph'
        };
        formatIndicator.textContent = labels[formatName] || formatName;
        formatIndicator.classList.add('show');
        formatIndicatorTimeout = setTimeout(() => {
            formatIndicator.classList.remove('show');
        }, 1200);
    }

    // ===== Dark Mode =====
    darkModeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        darkModeBtn.textContent = isDark ? '☀️' : '🌙';
        darkModeBtn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        saveSetting('darkMode', isDark);
    });

    // ===== Settings Panel =====
    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('show');
        settingsBtn.classList.toggle('active');
    });

    autoCopyToggle.addEventListener('change', () => {
        saveSetting('autoCopy', autoCopyToggle.checked);
    });

    preserveImagesToggle.addEventListener('change', () => {
        saveSetting('preserveImages', preserveImagesToggle.checked);
        updateOutput();
    });

    stripEmptyToggle.addEventListener('change', () => {
        saveSetting('stripEmpty', stripEmptyToggle.checked);
        updateOutput();
    });

    preserveHeadingsToggle.addEventListener('change', () => {
        saveSetting('preserveHeadings', preserveHeadingsToggle.checked);
    });

    smartQuotesToggle.addEventListener('change', () => {
        saveSetting('smartQuotes', smartQuotesToggle.checked);
        updateOutput();
    });

    retainImageLinksToggle.addEventListener('change', () => {
        saveSetting('retainImageLinks', retainImageLinksToggle.checked);
        updateOutput();
    });

    // ===== Preview Toggle =====
    previewToggle.addEventListener('click', () => {
        previewMode = !previewMode;
        previewToggle.classList.toggle('active', previewMode);
        previewArea.classList.toggle('show', previewMode);
        if (previewMode) {
            previewArea.innerHTML = output.textContent;
        }
    });

    // ===== Input Handlers =====
    editor.addEventListener('input', () => {
        updateOutput();
        updateToolbarState();
    });

    editor.addEventListener('paste', (e) => {
        // Intercept paste to clean Google Docs artifacts
        const clipboardData = e.clipboardData || window.clipboardData;
        const htmlData = clipboardData.getData('text/html');

        if (htmlData) {
            e.preventDefault();
            // Clean the pasted HTML before inserting
            const cleaned = preCleanPastedHTML(htmlData);
            document.execCommand('insertHTML', false, cleaned);
            setTimeout(() => {
                updateOutput();
                updateStats();
            }, 10);
        } else {
            setTimeout(() => {
                updateOutput();
                updateStats();
            }, 10);
        }
    });

    // ===== Drag and Drop support =====
    editor.addEventListener('dragover', (e) => {
        e.preventDefault();
        editor.classList.add('drag-over');
    });

    editor.addEventListener('dragleave', () => {
        editor.classList.remove('drag-over');
    });

    editor.addEventListener('drop', (e) => {
        editor.classList.remove('drag-over');
        setTimeout(updateOutput, 50);
    });

    // ===== Track selection for toolbar state =====
    document.addEventListener('selectionchange', () => {
        updateToolbarState();
    });

    // ===== Keyboard Shortcuts =====
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+C = Copy output
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
            e.preventDefault();
            const text = output.textContent;
            if (text) {
                copyToClipboard(text);
                showAlert('Copied to clipboard!');
            }
        }
        // Ctrl+Shift+X = Clear editor
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyX') {
            e.preventDefault();
            editor.innerHTML = '';
            output.textContent = '';
            previewArea.innerHTML = '';
            updateStats();
            editor.focus();
            showAlert('Editor cleared');
        }
        // Ctrl+Shift+P = Toggle preview
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
            e.preventDefault();
            previewToggle.click();
        }
    });

    // ===== Toolbar State Tracking =====
    function updateToolbarState() {
        commandBtns.forEach(btn => {
            const cmd = btn.getAttribute('data-command');
            try {
                const isActive = document.queryCommandState(cmd);
                btn.classList.toggle('active', isActive);
            } catch (e) {
                // Some commands don't support queryCommandState
            }
        });
    }

    // ===== Update Output =====
    function updateOutput() {
        const html = editor.innerHTML;
        const cleaned = cleanHTML(html);
        output.textContent = cleaned;
        updateStats();

        // Update preview if active
        if (previewMode) {
            previewArea.innerHTML = cleaned;
        }

        // Auto-copy if enabled
        if (autoCopyToggle.checked && cleaned) {
            copyToClipboard(cleaned);
        }
    }

    // ===== Stats with animation =====
    function updateStats() {
        const text = editor.textContent || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        const links = editor.querySelectorAll('a').length;
        const paras = editor.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li').length || 
                      (text.trim() ? 1 : 0);

        animateStat(wordCountEl, words);
        animateStat(charCountEl, chars);
        animateStat(linkCountEl, links);
        animateStat(paraCountEl, paras);
    }

    function animateStat(el, newValue) {
        const oldValue = parseInt(el.textContent) || 0;
        if (oldValue !== newValue) {
            el.textContent = newValue;
            el.classList.add('bump');
            setTimeout(() => el.classList.remove('bump'), 300);
        }
    }

    // ===== Pre-clean pasted HTML (before insertion) =====
    function preCleanPastedHTML(html) {
        // Remove Google Docs wrapper artifacts
        let cleaned = html;

        // Strip <meta>, <style>, <script> tags
        cleaned = cleaned.replace(/<meta[^>]*>/gi, '');
        cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');
        cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');

        // Remove Google Docs specific attributes
        cleaned = cleaned.replace(/\s+(id|class|style|dir|role|aria-\w+)="[^"]*"/gi, '');

        // Remove <b style="font-weight:normal"> wrapping (Google Docs artifact)
        cleaned = cleaned.replace(/<b\s*>([\s\S]*?)<\/b>/gi, (match, content) => {
            return content;
        });

        // Remove empty spans
        cleaned = cleaned.replace(/<span\s*>([\s\S]*?)<\/span>/gi, '$1');

        return cleaned;
    }

    // ===== Settings Persistence =====
    function saveSetting(key, value) {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const data = {};
                data['setting_' + key] = value;
                chrome.storage.local.set(data);
            } else {
                localStorage.setItem('setting_' + key, JSON.stringify(value));
            }
        } catch (e) {
            // Silently fail
        }
    }

    function loadSettings() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(
                    ['setting_darkMode', 'setting_autoCopy', 'setting_preserveImages', 
                     'setting_stripEmpty', 'setting_preserveHeadings', 'setting_smartQuotes', 'setting_retainImageLinks'],
                    (result) => {
                        if (result.setting_darkMode) {
                            document.body.classList.add('dark-mode');
                            darkModeBtn.textContent = '☀️';
                            darkModeBtn.title = 'Switch to Light Mode';
                        }
                        if (result.setting_autoCopy) autoCopyToggle.checked = true;
                        if (result.setting_preserveImages) preserveImagesToggle.checked = true;
                        if (result.setting_stripEmpty === false) stripEmptyToggle.checked = false;
                        if (result.setting_preserveHeadings === false) preserveHeadingsToggle.checked = false;
                        if (result.setting_smartQuotes === false) smartQuotesToggle.checked = false;
                        if (result.setting_retainImageLinks) retainImageLinksToggle.checked = true;
                    }
                );
            } else {
                // Fallback to localStorage
                if (JSON.parse(localStorage.getItem('setting_darkMode') || 'false')) {
                    document.body.classList.add('dark-mode');
                    darkModeBtn.textContent = '☀️';
                }
                autoCopyToggle.checked = JSON.parse(localStorage.getItem('setting_autoCopy') || 'false');
                preserveImagesToggle.checked = JSON.parse(localStorage.getItem('setting_preserveImages') || 'false');
                const stripVal = localStorage.getItem('setting_stripEmpty');
                stripEmptyToggle.checked = stripVal === null ? true : JSON.parse(stripVal);
                const headingsVal = localStorage.getItem('setting_preserveHeadings');
                preserveHeadingsToggle.checked = headingsVal === null ? true : JSON.parse(headingsVal);
                const smartVal = localStorage.getItem('setting_smartQuotes');
                smartQuotesToggle.checked = smartVal === null ? true : JSON.parse(smartVal);
                retainImageLinksToggle.checked = JSON.parse(localStorage.getItem('setting_retainImageLinks') || 'false');
            }
        } catch (e) {
            // Silently fail
        }
    }

    // ===== Core Cleaning Logic =====
    function cleanHTML(html) {
        if (!html) return '';

        const temp = document.createElement('div');
        temp.innerHTML = html;

        const preserveImages = preserveImagesToggle.checked;
        const retainImageLinks = retainImageLinksToggle.checked;
        const stripEmpty = stripEmptyToggle.checked;
        const smartQuotes = smartQuotesToggle.checked;

        // 1. Remove wrapper tags (span, font, div) but keep content
        const removeWrappers = (element) => {
            const wrapTags = ['span', 'font', 'div'];
            wrapTags.forEach(tag => {
                // Continuously process until none remain (nested wrappers)
                let wrappers;
                do {
                    wrappers = element.querySelectorAll(tag);
                    wrappers.forEach(wrapper => {
                        const parent = wrapper.parentNode;
                        if (!parent) return;
                        while (wrapper.firstChild) {
                            parent.insertBefore(wrapper.firstChild, wrapper);
                        }
                        parent.removeChild(wrapper);
                    });
                } while (wrappers.length > 0);
            });
        };

        removeWrappers(temp);

        // 2. Unwrap paragraphs inside list items (Google Docs artifact)
        const listItems = temp.querySelectorAll('li');
        listItems.forEach(li => {
            const paragraphs = li.querySelectorAll('p');
            paragraphs.forEach(p => {
                while (p.firstChild) {
                    li.insertBefore(p.firstChild, p);
                }
                p.remove();
            });
        });

        // 3. Flatten nested lists that are redundant
        const nestedLists = temp.querySelectorAll('ul > ul, ol > ol');
        nestedLists.forEach(nested => {
            const parent = nested.parentNode;
            if (parent && (parent.tagName === 'UL' || parent.tagName === 'OL')) {
                while (nested.firstChild) {
                    parent.insertBefore(nested.firstChild, nested);
                }
                nested.remove();
            }
        });

        // 4. Clean attributes
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            const tagName = el.tagName.toLowerCase();

            if (tagName === 'a') {
                const href = el.getAttribute('href');
                const attributes = Array.from(el.attributes);
                attributes.forEach(attr => el.removeAttribute(attr.name));
                if (href) {
                    // Clean Google redirect URLs
                    let cleanHref = href;
                    try {
                        const url = new URL(href);
                        if (url.hostname.includes('google.com') && url.pathname.includes('/url')) {
                            cleanHref = url.searchParams.get('q') || url.searchParams.get('url') || href;
                        }
                    } catch (e) { /* keep original */ }
                    el.setAttribute('href', cleanHref);
                }
            } else if (tagName === 'img' && preserveImages) {
                const src = el.getAttribute('src');
                const alt = el.getAttribute('alt');
                const attributes = Array.from(el.attributes);
                attributes.forEach(attr => el.removeAttribute(attr.name));
                if (src) el.setAttribute('src', src);
                if (alt) el.setAttribute('alt', alt);
            } else if (tagName === 'img' && !preserveImages) {
                if (retainImageLinks) {
                    const src = el.getAttribute('src');
                    const alt = el.getAttribute('alt') || 'Image';
                    if (src) {
                        const link = document.createElement('a');
                        link.setAttribute('href', src);
                        link.textContent = `[Image: ${alt}]`;
                        el.parentNode.replaceChild(link, el);
                    } else {
                        el.remove();
                    }
                } else {
                    el.remove();
                }
            } else {
                const attributes = Array.from(el.attributes);
                attributes.forEach(attr => el.removeAttribute(attr.name));
            }
        });

        // 5. Remove empty elements (except <br> and optionally <img>)
        if (stripEmpty) {
            const removeEmptyRecursive = (element) => {
                Array.from(element.children).forEach(child => {
                    removeEmptyRecursive(child);
                    const tagName = child.tagName.toLowerCase();
                    const isEmpty = child.textContent.trim() === '' && !child.querySelector('img, iframe, br');
                    if (isEmpty && tagName !== 'br' && tagName !== 'img') {
                        child.remove();
                    }
                });
            };
            removeEmptyRecursive(temp);
        }

        let cleaned = temp.innerHTML;

        // 6. Remove HTML comments (like <!--StartFragment-->)
        cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

        // 7. Smart quotes → straight quotes
        if (smartQuotes) {
            cleaned = cleaned.replace(/[\u2018\u2019\u201A\u201B]/g, "'"); // single quotes
            cleaned = cleaned.replace(/[\u201C\u201D\u201E\u201F]/g, '"'); // double quotes
            cleaned = cleaned.replace(/[\u2013\u2014]/g, '-');             // em/en dash
            cleaned = cleaned.replace(/\u2026/g, '...');                    // ellipsis
            cleaned = cleaned.replace(/\u00A0/g, ' ');                      // non-breaking space
        }

        // 8. Regex Final Polish
        if (stripEmpty) {
            cleaned = cleaned.replace(/<p>\s*<\/p>/g, '');
            cleaned = cleaned.replace(/<p>&nbsp;<\/p>/g, '');
        }
        cleaned = cleaned.replace(/\s+/g, ' '); // Collapse whitespace

        // Add line breaks for readability
        cleaned = cleaned.replace(/<\/p>/g, '</p>\n');
        cleaned = cleaned.replace(/<\/li>/g, '</li>\n');
        cleaned = cleaned.replace(/<\/ul>/g, '</ul>\n');
        cleaned = cleaned.replace(/<\/ol>/g, '</ol>\n');
        cleaned = cleaned.replace(/<\/h([1-6])>/g, '</h$1>\n');
        cleaned = cleaned.replace(/<\/blockquote>/g, '</blockquote>\n');
        cleaned = cleaned.replace(/<ul>/g, '<ul>\n');
        cleaned = cleaned.replace(/<ol>/g, '<ol>\n');
        cleaned = cleaned.replace(/<blockquote>/g, '<blockquote>\n');

        // Indent list items
        cleaned = cleaned.replace(/<li>/g, '  <li>');

        // Clean up multiple newlines
        cleaned = cleaned.replace(/\n\s*\n/g, '\n');

        return cleaned.trim();
    }
});
