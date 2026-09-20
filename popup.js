(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const editor = $('editor');
    const output = $('output');
    const outputHint = $('outputHint');
    const codeOutputArea = $('codeOutputArea');
    const copyBtn = $('copyBtn');
    const clearBtn = $('clearBtn');
    const undoBtn = $('undoBtn');
    const redoBtn = $('redoBtn');
    const addLinkBtn = $('addLinkBtn');
    const removeLinkBtn = $('removeLinkBtn');
    const copyAlert = $('copyAlert');
    const darkModeBtn = $('darkModeBtn');
    const settingsBtn = $('settingsBtn');
    const settingsPanel = $('settingsPanel');
    const shortcutsBtn = $('shortcutsBtn');
    const shortcutsPanel = $('shortcutsPanel');
    const formatIndicator = $('formatIndicator');
    const resetSettingsBtn = $('resetSettingsBtn');
    const commandBtns = Array.from(document.querySelectorAll('.tool-btn[data-command]'));
    const blockBtns = Array.from(document.querySelectorAll('.tool-btn[data-block]'));
    const listBtns = Array.from(document.querySelectorAll('.tool-btn[data-list]'));
    const editorToggles = Array.from(document.querySelectorAll('.toggle-switch input[data-setting]'));
    const copyMenuBtn = $('copyMenuBtn');
    const copyMenu = $('copyMenu');
    const copyFmtLabel = $('copyFmtLabel');
    const copyOpts = Array.from(document.querySelectorAll('.copy-opt'));
    const statEls = {
        words: $('wordCount'),
        chars: $('charCount'),
        links: $('linkCount'),
        paras: $('paraCount')
    };

    const INLINE_TAGS = { bold: 'strong', italic: 'em', underline: 'u', strikethrough: 's' };
    const BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,blockquote,li,div';

    const DEFAULTS = {
        darkMode: false,
        autoCopy: false,
        preserveImages: false,
        retainImageLinks: false,
        stripEmpty: true,
        preserveHeadings: true,
        smartQuotes: true,
        copyFormat: 'html'
    };
    const settings = { ...DEFAULTS };

    let historyStack = [];
    let redoStack = [];
    let inputTimer = null;
    let toastTimer = null;
    let formatTimer = null;

    readSettings(applySettingsToUI);

    function readSettings(callback) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(null, (all) => {
                if (all && all.settings) {
                    Object.assign(settings, all.settings);
                    callback();
                    return;
                }
                if (all && Object.keys(all).some((k) => k.startsWith('setting_'))) {
                    if (typeof all.setting_darkMode !== 'undefined') settings.darkMode = !!all.setting_darkMode;
                    if (typeof all.setting_autoCopy !== 'undefined') settings.autoCopy = !!all.setting_autoCopy;
                    if (typeof all.setting_preserveImages !== 'undefined') settings.preserveImages = !!all.setting_preserveImages;
                    if (typeof all.setting_retainImageLinks !== 'undefined') settings.retainImageLinks = !!all.setting_retainImageLinks;
                    if (typeof all.setting_stripEmpty !== 'undefined') settings.stripEmpty = !!all.setting_stripEmpty;
                    if (typeof all.setting_preserveHeadings !== 'undefined') settings.preserveHeadings = !!all.setting_preserveHeadings;
                    if (typeof all.setting_smartQuotes !== 'undefined') settings.smartQuotes = !!all.setting_smartQuotes;
                    saveSettings();
                    callback();
                    return;
                }
                callback();
            });
        } else {
            Object.keys(DEFAULTS).forEach((key) => {
                const raw = localStorage.getItem('setting_' + key);
                if (raw !== null) settings[key] = JSON.parse(raw);
            });
            callback();
        }
    }

    function saveSettings() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ settings });
        } else {
            Object.entries(settings).forEach(([key, value]) => {
                localStorage.setItem('setting_' + key, JSON.stringify(value));
            });
        }
    }

    function applySettingsToUI() {
        document.body.classList.toggle('dark-mode', settings.darkMode);
        darkModeBtn.title = settings.darkMode ? 'Switch to light mode' : 'Switch to dark mode';
        editorToggles.forEach((toggle) => {
            if (settings[toggle.dataset.setting] !== undefined) {
                toggle.checked = settings[toggle.dataset.setting];
            }
        });
    }

    // ===== History =====

    function pushHistory() {
        historyStack.push(editor.innerHTML);
        if (historyStack.length > 100) historyStack.shift();
        redoStack = [];
        updateHistoryButtons();
    }

    function undo() {
        if (!historyStack.length) return;
        redoStack.push(editor.innerHTML);
        editor.innerHTML = historyStack.pop();
        updateOutput();
        updateHistoryButtons();
        editor.focus();
    }

    function redo() {
        if (!redoStack.length) return;
        historyStack.push(editor.innerHTML);
        editor.innerHTML = redoStack.pop();
        updateOutput();
        updateHistoryButtons();
        editor.focus();
    }

    function updateHistoryButtons() {
        undoBtn.disabled = !historyStack.length;
        redoBtn.disabled = !redoStack.length;
    }

    // ===== Selection & Range helpers =====

    function selectionRange() {
        const sel = window.getSelection();
        return sel.rangeCount ? sel.getRangeAt(0) : null;
    }

    function isInTag(node, tag) {
        const el = node && (node.nodeType === 1 ? node : node.parentElement);
        return !!(el && el.closest && el.closest(tag));
    }

    function enclosingBlock(node) {
        let el = node;
        if (el && el.nodeType !== 1) el = el.parentElement;
        while (el && el !== editor) {
            if (el.matches && el.matches(BLOCK_SELECTOR)) return el;
            el = el.parentElement;
        }
        return null;
    }

    function touchedBlocks(range) {
        const blocks = new Set();
        const start = enclosingBlock(range.startContainer);
        const end = enclosingBlock(range.endContainer);
        if (start) blocks.add(start);
        if (end) blocks.add(end);
        const container = range.commonAncestorContainer;
        const root = container.nodeType === 1 ? container : container.parentElement;
        if (root && editor.contains(root)) {
            root.querySelectorAll(BLOCK_SELECTOR).forEach((block) => {
                if (block !== start && block !== end && range.intersectsNode(block)) blocks.add(block);
            });
        }
        return Array.from(blocks);
    }

    function placeCaretAtEnd(el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // ===== Formatting (DOM-based, no execCommand) =====

    function toggleInline(tag) {
        const range = selectionRange();
        if (!range || range.collapsed) return;
        pushHistory();
        const active = isInTag(range.startContainer, tag) && isInTag(range.endContainer, tag);
        const sel = window.getSelection();
        if (active) {
            const container = range.commonAncestorContainer;
            const ancestor = container.nodeType === 1 ? container : container.parentElement;
            [ancestor, ...ancestor.querySelectorAll(tag)]
                .filter((el) => el && el.nodeType === 1 && el.matches(tag))
                .forEach((el) => unwrap(el));
        } else {
            const el = document.createElement(tag);
            el.appendChild(range.extractContents());
            range.insertNode(el);
            const next = document.createRange();
            next.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(next);
        }
        commit();
    }

    function applyBlock(tag) {
        const range = selectionRange();
        if (!range) return;
        pushHistory();
        if (range.collapsed) {
            const block = enclosingBlock(range.startContainer);
            if (block) {
                if (block.tagName.toLowerCase() !== tag) {
                    const el = replaceBlock(block, tag);
                    placeCaretAtEnd(el);
                }
            } else {
                const el = document.createElement(tag);
                el.appendChild(document.createElement('br'));
                range.insertNode(el);
                placeCaretAtEnd(el);
            }
        } else {
            const blocks = touchedBlocks(range);
            let last = null;
            if (blocks.length) {
                blocks.forEach((block) => {
                    if (block.tagName.toLowerCase() !== tag) last = replaceBlock(block, tag);
                });
            } else {
                last = document.createElement(tag);
                last.appendChild(range.extractContents());
                range.insertNode(last);
            }
            if (last) placeCaretAtEnd(last);
        }
        commit();
    }

    function replaceBlock(block, tag) {
        const el = document.createElement(tag);
        while (block.firstChild) el.appendChild(block.firstChild);
        block.replaceWith(el);
        return el;
    }

    function toggleList(tag) {
        const range = selectionRange();
        if (!range) return;
        const block = enclosingBlock(range.startContainer);
        const existing = block && block.closest(tag);
        if (!existing) {
            const targets = range.collapsed
                ? (block ? [block] : [])
                : touchedBlocks(range);
            if (!targets.length) return;
        }
        pushHistory();
        if (existing) {
            existing.querySelectorAll('li').forEach((li) => {
                const p = document.createElement('p');
                while (li.firstChild) p.appendChild(li.firstChild);
                li.replaceWith(p);
            });
            const caretBlock = existing.querySelector('p,h1,h2,h3,h4,h5,h6,blockquote,li,div');
            if (existing.tagName === 'UL' || existing.tagName === 'OL') unwrap(existing);
            if (caretBlock) placeCaretAtEnd(caretBlock);
        } else {
            const targets = range.collapsed
                ? [block]
                : touchedBlocks(range);
            let last = null;
            targets.forEach((target) => {
                const listEl = document.createElement(tag);
                const li = document.createElement('li');
                while (target.firstChild) li.appendChild(target.firstChild);
                listEl.appendChild(li);
                target.replaceWith(listEl);
                last = li;
            });
            if (last) placeCaretAtEnd(last);
        }
        commit();
    }

    function createLink(url) {
        const range = selectionRange();
        if (!range || range.collapsed) return;
        pushHistory();
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.appendChild(range.extractContents());
        range.insertNode(a);
        commit();
    }

    function removeAllLinks() {
        const links = editor.querySelectorAll('a');
        if (!links.length) {
            toast('No links to remove');
            return;
        }
        pushHistory();
        links.forEach((link) => unwrap(link));
        toast(links.length + ' link' + (links.length > 1 ? 's' : '') + ' removed!');
        commit();
    }

    function commit() {
        updateOutput();
        updateToolbarState();
        editor.focus();
    }

    function updateToolbarState() {
        const sel = window.getSelection();
        const anchor = sel && sel.anchorNode;
        const el = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement);
        commandBtns.forEach((btn) => {
            const tag = INLINE_TAGS[btn.dataset.command];
            btn.classList.toggle('active', !!tag && !!el && isInTag(anchor, tag));
        });
        blockBtns.forEach((btn) => {
            btn.classList.toggle('active', !!el && isInTag(anchor, btn.dataset.block));
        });
        const list = el && el.closest('ul,ol');
        listBtns.forEach((btn) => {
            btn.classList.toggle('active', !!list && list.tagName.toLowerCase() === btn.dataset.list);
        });
    }

    // ===== DOM utilities =====

    function unwrap(el) {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
    }

    function rename(el, tag) {
        const next = document.createElement(tag);
        while (el.firstChild) next.appendChild(el.firstChild);
        el.replaceWith(next);
    }

    function removeEmptyRecursive(root) {
        let changed = true;
        while (changed) {
            changed = false;
            root.querySelectorAll(BLOCK_SELECTOR + ',span,a').forEach((el) => {
                if (el.textContent.trim() === '' && !el.querySelector('img,iframe,br,video,audio')) {
                    el.remove();
                    changed = true;
                }
            });
        }
    }

    function removeComments(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
        const comments = [];
        while (walker.nextNode()) comments.push(walker.currentNode);
        comments.forEach((c) => c.remove());
    }

    const BLOCK_TAGS = /^(P|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|LI|UL|OL|DIV|TABLE)$/i;

    function normalizeLineBreaks(root) {
        root.querySelectorAll('br').forEach((br) => {
            let next = br.nextSibling;
            while (next && next.nodeType === 3 && !next.nodeValue.trim()) next = next.nextSibling;
            let prev = br.previousSibling;
            while (prev && prev.nodeType === 3 && !prev.nodeValue.trim()) prev = prev.previousSibling;
            const atBoundary = !prev || !next ||
                (prev.nodeType === 1 && BLOCK_TAGS.test(prev.tagName)) ||
                (next.nodeType === 1 && BLOCK_TAGS.test(next.tagName));
            if (atBoundary) {
                br.remove();
            } else {
                const space = document.createTextNode(' ');
                br.replaceWith(space);
            }
        });
    }

    function cleanUrl(href) {
        try {
            const url = new URL(href);
            if (/\.google\.[a-z.]+$/.test(url.hostname) && url.pathname.startsWith('/url')) {
                return url.searchParams.get('q') || url.searchParams.get('url') || href;
            }
            return href;
        } catch (e) {
            return href;
        }
    }

    function normalizePunctuation(text) {
        return text
            .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
            .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/\u2026/g, '...');
    }

    // ===== Cleaning engine =====

    function cleanHTML(source) {
        if (!source) return '';
        const root = document.createElement('div');
        root.innerHTML = source;

        root.querySelectorAll('style,meta,link,script,title').forEach((el) => el.remove());

        if (!settings.preserveHeadings) {
            root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
                const p = document.createElement('p');
                while (h.firstChild) p.appendChild(h.firstChild);
                h.replaceWith(p);
            });
        }

        ['span', 'font', 'div'].forEach((tag) => {
            root.querySelectorAll(tag).forEach((el) => unwrap(el));
        });
        root.querySelectorAll('b,strong').forEach((el) => {
            if (/font-weight\s*:\s*normal/i.test(el.getAttribute('style') || '')) unwrap(el);
        });
        root.querySelectorAll('i,em').forEach((el) => {
            if (/font-style\s*:\s*normal/i.test(el.getAttribute('style') || '')) unwrap(el);
        });
        root.querySelectorAll('b').forEach((el) => rename(el, 'strong'));
        root.querySelectorAll('i').forEach((el) => rename(el, 'em'));

        root.querySelectorAll('li').forEach((li) => {
            li.querySelectorAll('p,div').forEach((p) => unwrap(p));
        });

        let listChanged = true;
        while (listChanged) {
            listChanged = false;
            root.querySelectorAll('li > ul, li > ol').forEach((nested) => {
                const li = nested.parentNode;
                const list = li.parentNode;
                const anchor = li.nextSibling;
                nested.remove();
                while (nested.firstChild) list.insertBefore(nested.firstChild, anchor);
                listChanged = true;
            });
        }
        root.querySelectorAll('ul > ul, ol > ol, ul > ol, ol > ul').forEach((nested) => unwrap(nested));
        normalizeLineBreaks(root);

        const ALLOWED = {
            a: ['href'],
            img: settings.preserveImages
                ? ['src', 'alt', 'title', 'width', 'height']
                : settings.retainImageLinks ? ['src', 'alt'] : [],
            td: ['colspan', 'rowspan'],
            th: ['colspan', 'rowspan', 'scope']
        };
        root.querySelectorAll('*').forEach((el) => {
            const tag = el.tagName.toLowerCase();
            const allowed = ALLOWED[tag] || [];
            Array.from(el.attributes).forEach((attr) => {
                if (!allowed.includes(attr.name)) el.removeAttribute(attr.name);
            });
            if (tag === 'a') {
                const href = el.getAttribute('href');
                if (href) el.setAttribute('href', cleanUrl(href));
            }
        });

        if (!settings.preserveImages) {
            root.querySelectorAll('img').forEach((img) => {
                const src = img.getAttribute('src');
                if (settings.retainImageLinks && src) {
                    const a = document.createElement('a');
                    a.setAttribute('href', src);
                    a.textContent = '[Image: ' + (img.getAttribute('alt') || 'Image') + ']';
                    img.replaceWith(a);
                } else {
                    img.remove();
                }
            });
        }

        if (settings.smartQuotes) {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
                walker.currentNode.nodeValue = normalizePunctuation(walker.currentNode.nodeValue);
            }
        }

        if (settings.stripEmpty) removeEmptyRecursive(root);
        removeComments(root);

        return formatOutput(root.innerHTML);
    }

    function formatOutput(html) {
        let cleaned = html.replace(/\u00A0/g, ' ');
        if (settings.stripEmpty) {
            cleaned = cleaned.replace(/<p>\s*<\/p>/g, '');
            cleaned = cleaned.replace(/<p>\s*<br>\s*<\/p>/gi, '');
        }
        cleaned = cleaned.replace(/\s+/g, ' ');
        cleaned = cleaned.replace(/<\/p>/g, '</p>\n');
        cleaned = cleaned.replace(/<\/li>/g, '</li>\n');
        cleaned = cleaned.replace(/<\/ul>/g, '</ul>\n');
        cleaned = cleaned.replace(/<\/ol>/g, '</ol>\n');
        cleaned = cleaned.replace(/<\/h([1-6])>/g, '</h$1>\n');
        cleaned = cleaned.replace(/<\/blockquote>/g, '</blockquote>\n');
        cleaned = cleaned.replace(/<ul>/g, '<ul>\n');
        cleaned = cleaned.replace(/<ol>/g, '<ol>\n');
        cleaned = cleaned.replace(/<blockquote>/g, '<blockquote>\n');
        cleaned = cleaned.replace(/<li>/g, '  <li>');
        cleaned = cleaned.replace(/\n\s*\n/g, '\n');
        return cleaned.trim();
    }

    // ===== Output rendering =====

    function updateOutput() {
        const cleaned = cleanHTML(editor.innerHTML);
        output.textContent = cleaned;
        outputHint.classList.toggle('hidden', cleaned !== '');
        updateStats();
        if (settings.autoCopy && cleaned) copyToClipboard(getCopyText());
    }

    // ===== Stats =====

    function updateStats() {
        const text = editor.textContent || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const links = editor.querySelectorAll('a').length;
        const paras = editor.querySelectorAll(BLOCK_SELECTOR).length || (text.trim() ? 1 : 0);
        animateStat(statEls.words, words);
        animateStat(statEls.chars, text.length);
        animateStat(statEls.links, links);
        animateStat(statEls.paras, paras);
    }

    function animateStat(el, value) {
        const old = parseInt(el.textContent, 10) || 0;
        if (old !== value) {
            el.textContent = value;
            el.classList.add('bump');
            setTimeout(() => el.classList.remove('bump'), 300);
        }
    }

    // ===== Clipboard =====

    function getCopyText() {
        const html = output.textContent;
        if (!html) return '';
        if (settings.copyFormat === 'text') return htmlToText(html);
        if (settings.copyFormat === 'markdown') return htmlToMarkdown(html);
        return html;
    }

    function htmlToText(html) {
        const root = document.createElement('div');
        root.innerHTML = html;
        const parts = [];
        const walk = (node) => {
            node.childNodes.forEach((child) => {
                if (child.nodeType === 3) {
                    parts.push(child.nodeValue);
                } else if (child.nodeType === 1) {
                    walk(child);
                    if (/^(P|H[1-6]|LI|BLOCKQUOTE|DIV|TR)$/i.test(child.tagName)) parts.push('\n');
                }
            });
        };
        walk(root);
        return parts.join('').replace(/[ \t]*\n[ \t\n]+/g, '\n').replace(/\n{2,}/g, '\n\n').trim();
    }

    function htmlToMarkdown(html) {
        const root = document.createElement('div');
        root.innerHTML = html;
        const lines = [];

        const inline = (node) => {
            let text = '';
            node.childNodes.forEach((child) => {
                if (child.nodeType === 3) {
                    text += child.nodeValue;
                } else if (child.nodeType === 1) {
                    const tag = child.tagName.toLowerCase();
                    const inner = inline(child).trim();
                    if (tag === 'strong' || tag === 'b') text += '**' + inner + '**';
                    else if (tag === 'em' || tag === 'i') text += '*' + inner + '*';
                    else if (tag === 's') text += '~~' + inner + '~~';
                    else if (tag === 'code') text += '`' + inner + '`';
                    else if (tag === 'a') {
                        const href = child.getAttribute('href');
                        text += href ? '[' + inner + '](' + href + ')' : inner;
                    } else if (tag === 'br') text += ' ';
                    else text += inline(child);
                }
            });
            return text.replace(/\s{2,}/g, ' ');
        };

        const block = (node, indent) => {
            const tag = node.tagName.toLowerCase();
            if (/^h[1-6]$/.test(tag)) {
                const t = inline(node).trim();
                if (t) lines.push(indent + '#'.repeat(Number(tag[1])) + ' ' + t);
            } else if (tag === 'p') {
                const t = inline(node).trim();
                if (t) lines.push(indent + t);
            } else if (tag === 'blockquote') {
                const t = inline(node).trim();
                if (t) lines.push(indent + '> ' + t);
            } else if (tag === 'ul' || tag === 'ol') {
                let index = 1;
                Array.from(node.children).forEach((li) => {
                    const marker = tag === 'ol' ? index + '. ' : '- ';
                    const text = inline(li).trim();
                    lines.push(indent + marker + text.replace(/\n/g, ' '));
                    Array.from(li.children).forEach((child) => {
                        if (child.tagName === 'UL' || child.tagName === 'OL') block(child, indent + '  ');
                    });
                    if (tag === 'ol') index++;
                });
            } else if (tag === 'td' || tag === 'th') {
                const t = inline(node).trim();
                lines.push(indent + '| ' + t + ' ');
            } else {
                node.childNodes.forEach((child) => {
                    if (child.nodeType === 1) block(child, indent);
                    else if (child.nodeType === 3 && child.nodeValue.trim()) lines.push(indent + child.nodeValue.trim());
                });
            }
        };

        root.childNodes.forEach((child) => {
            if (child.nodeType === 1) block(child, '');
            else if (child.nodeType === 3 && child.nodeValue.trim()) lines.push(child.nodeValue.trim());
        });

        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function updateCopyFormatUI() {
        const labels = { html: 'HTML', text: 'Text', markdown: 'MD' };
        copyOpts.forEach((el) => el.classList.toggle('active', el.dataset.format === settings.copyFormat));
        copyFmtLabel.textContent = labels[settings.copyFormat] || 'HTML';
        copyBtn.title = 'Copy output as ' + (labels[settings.copyFormat] || 'HTML');
    }

    function setCopyFormat(fmt) {
        settings.copyFormat = fmt;
        saveSettings();
        updateCopyFormatUI();
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
            } catch (e) { /* no-op */ }
            document.body.removeChild(textarea);
        }
    }

    function toast(message) {
        const text = copyAlert.querySelector('.alert-text');
        if (text) text.textContent = message;
        clearTimeout(toastTimer);
        copyAlert.classList.add('show');
        toastTimer = setTimeout(() => copyAlert.classList.remove('show'), 2200);
    }

    function showFormatIndicator(name) {
        clearTimeout(formatTimer);
        const labels = {
            bold: 'Bold',
            italic: 'Italic',
            underline: 'Underline',
            strikethrough: 'Strikethrough',
            insertUlList: 'Bullet List',
            insertOlList: 'Numbered List',
            h1: 'Heading 1',
            h2: 'Heading 2',
            h3: 'Heading 3',
            blockquote: 'Blockquote',
            p: 'Paragraph'
        };
        formatIndicator.textContent = labels[name] || name;
        formatIndicator.classList.add('show');
        formatTimer = setTimeout(() => formatIndicator.classList.remove('show'), 1200);
    }

    // ===== Events =====

    commandBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            toggleInline(INLINE_TAGS[btn.dataset.command]);
            showFormatIndicator(btn.dataset.command);
        });
    });

    blockBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            applyBlock(btn.dataset.block);
            showFormatIndicator(btn.dataset.block);
        });
    });

    listBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            toggleList(btn.dataset.list);
            showFormatIndicator('insert' + btn.dataset.list.charAt(0).toUpperCase() + btn.dataset.list.slice(1) + 'List');
        });
    });

    addLinkBtn.addEventListener('click', () => {
        const range = selectionRange();
        if (!range || range.collapsed || !range.toString().trim()) {
            toast('Select text first to add a link');
            return;
        }
        const url = prompt('Enter URL:', 'https://');
        if (url && url !== 'https://') {
            createLink(url);
            toast('Link added!');
        }
    });

    removeLinkBtn.addEventListener('click', removeAllLinks);
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    clearBtn.addEventListener('click', () => {
        if (!editor.textContent.trim() && !editor.querySelector('img,iframe,br')) {
            toast('Editor is empty');
            return;
        }
        pushHistory();
        editor.innerHTML = '';
        updateOutput();
        updateHistoryButtons();
        editor.focus();
        toast('Editor cleared');
    });

    copyMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyMenu.classList.toggle('hidden');
    });

    copyOpts.forEach((opt) => {
        opt.addEventListener('click', () => {
            setCopyFormat(opt.dataset.format);
            copyMenu.classList.add('hidden');
            copyBtn.click();
        });
    });

    document.addEventListener('click', () => copyMenu.classList.add('hidden'));
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') copyMenu.classList.add('hidden');
    });

    copyBtn.addEventListener('click', async () => {
        const text = getCopyText();
        if (!text) {
            toast('Nothing to copy');
            return;
        }
        await copyToClipboard(text);
        copyBtn.classList.add('copied');
        const original = copyBtn.innerHTML;
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = original;
        }, 1500);
        toast('Copied to clipboard!');
    });

    darkModeBtn.addEventListener('click', () => {
        settings.darkMode = !settings.darkMode;
        applySettingsToUI();
        saveSettings();
    });

    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('show');
        settingsBtn.classList.toggle('active');
    });

    shortcutsBtn.addEventListener('click', () => {
        shortcutsPanel.classList.toggle('show');
        shortcutsBtn.classList.toggle('active');
    });

    editorToggles.forEach((toggle) => {
        toggle.addEventListener('change', () => {
            settings[toggle.dataset.setting] = toggle.checked;
            saveSettings();
            if (['stripEmpty', 'preserveImages', 'retainImageLinks', 'smartQuotes', 'preserveHeadings'].includes(toggle.dataset.setting)) {
                updateOutput();
            }
        });
    });

    resetSettingsBtn.addEventListener('click', () => {
        Object.assign(settings, DEFAULTS);
        saveSettings();
        applySettingsToUI();
        updateOutput();
        toast('Settings reset');
    });

    editor.addEventListener('input', () => {
        clearTimeout(inputTimer);
        inputTimer = setTimeout(pushHistory, 700);
        updateOutput();
        updateToolbarState();
    });

    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        const clipboard = e.clipboardData || window.clipboardData;
        if (!clipboard) return;
        const html = clipboard.getData('text/html');
        const plain = clipboard.getData('text/plain');
        pushHistory();
        const range = selectionRange();
        const sel = window.getSelection();
        if (html) {
            const holder = buildFragment(html);
            if (range) {
                range.deleteContents();
                const frag = document.createDocumentFragment();
                while (holder.firstChild) frag.appendChild(holder.firstChild);
                range.insertNode(frag);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            } else {
                while (holder.firstChild) editor.appendChild(holder.firstChild);
                editor.focus();
            }
        } else if (plain !== undefined) {
            if (range) {
                range.deleteContents();
                const textNode = document.createTextNode(plain);
                range.insertNode(textNode);
                const next = document.createRange();
                next.setStartAfter(textNode);
                next.collapse(true);
                sel.removeAllRanges();
                sel.addRange(next);
            } else {
                editor.appendChild(document.createTextNode(plain));
                editor.focus();
            }
        }
        updateOutput();
        updateStats();
    });

    function buildFragment(html) {
        const holder = document.createElement('div');
        holder.innerHTML = html;
        return holder;
    }

    editor.addEventListener('dragover', (e) => {
        e.preventDefault();
        editor.classList.add('drag-over');
    });

    editor.addEventListener('dragleave', () => editor.classList.remove('drag-over'));

    editor.addEventListener('drop', (e) => {
        e.preventDefault();
        editor.classList.remove('drag-over');
        if (e.dataTransfer) {
            const html = e.dataTransfer.getData('text/html');
            const text = e.dataTransfer.getData('text/plain');
            const range = selectionRange();
            pushHistory();
            if (html && range) {
                const holder = buildFragment(html);
                range.deleteContents();
                const frag = document.createDocumentFragment();
                while (holder.firstChild) frag.appendChild(holder.firstChild);
                range.insertNode(frag);
            } else if (text) {
                editor.appendChild(document.createTextNode(text));
            }
        }
        updateOutput();
        editor.focus();
    });

    document.addEventListener('selectionchange', updateToolbarState);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
            e.preventDefault();
            if (output.textContent) {
                copyToClipboard(getCopyText());
                toast('Copied to clipboard!');
            }
        } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyX') {
            e.preventDefault();
            clearBtn.click();
        } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if ((e.code === 'KeyY' && (e.ctrlKey || e.metaKey)) || (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
            e.preventDefault();
            redo();
        }
    });

    updateHistoryButtons();
    updateCopyFormatUI();
    editor.focus();
})();