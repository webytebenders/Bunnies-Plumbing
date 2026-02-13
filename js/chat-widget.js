/**
 * Chat Widget — Bunnies Plumbing
 * Self-contained IIFE that creates an AI chat widget.
 */
(function () {
    'use strict';

    // --- Configuration ---
    var API_PATH = (function () {
        var path = window.location.pathname;
        // If page is in a subdirectory (e.g., /posts/), go up one level
        var depth = path.replace(/\/[^/]*$/, '').split('/').filter(Boolean).length;
        var prefix = '';
        for (var i = 0; i < depth; i++) prefix += '../';
        return prefix + 'api/chat.php';
    })();

    var QUICK_QUESTIONS = [
        'What services do you offer?',
        'What is trenchless?',
        'How much does it cost?',
        'Are you available 24/7?',
        'Do you offer free estimates?'
    ];

    var PHONE = '(408) 427-5318';
    var conversationHistory = [];
    var isOpen = false;
    var isSending = false;

    // --- Build DOM ---
    function createWidget() {
        // Toggle button
        var toggle = el('button', {
            className: 'chat-widget__toggle',
            'aria-label': 'Open chat',
            type: 'button'
        }, [
            el('span', { className: 'chat-widget__icon-open', innerHTML: '<i class="fas fa-comment-dots"></i>' }),
            el('span', { className: 'chat-widget__icon-close', innerHTML: '<i class="fas fa-times"></i>' })
        ]);

        // Chat window
        var header = el('div', { className: 'chat-widget__header' }, [
            el('div', { className: 'chat-widget__header-info' }, [
                el('div', { className: 'chat-widget__header-title', textContent: 'Bunnies Plumbing' }),
                el('div', { className: 'chat-widget__header-status' }, [
                    el('span', { className: 'chat-widget__status-dot' }),
                    document.createTextNode('Online 24/7')
                ])
            ]),
            el('button', {
                className: 'chat-widget__close',
                'aria-label': 'Close chat',
                type: 'button',
                innerHTML: '<i class="fas fa-times"></i>',
                onclick: toggleChat
            })
        ]);

        var messagesContainer = el('div', { className: 'chat-widget__messages', id: 'chatMessages' });

        var textarea = el('textarea', {
            className: 'chat-widget__textarea',
            id: 'chatInput',
            placeholder: 'Type a message...',
            rows: 1
        });

        var sendBtn = el('button', {
            className: 'chat-widget__send',
            id: 'chatSend',
            type: 'button',
            'aria-label': 'Send message',
            innerHTML: '<i class="fas fa-paper-plane"></i>'
        });

        var inputArea = el('div', { className: 'chat-widget__input-area' }, [textarea, sendBtn]);

        var chatWindow = el('div', { className: 'chat-widget__window', id: 'chatWindow' }, [
            header,
            messagesContainer,
            inputArea
        ]);

        document.body.appendChild(toggle);
        document.body.appendChild(chatWindow);

        // Show welcome
        showWelcome(messagesContainer);

        // --- Event listeners ---
        toggle.addEventListener('click', toggleChat);
        sendBtn.addEventListener('click', sendMessage);

        textarea.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize textarea
        textarea.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        });

        // Store references
        createWidget.toggle = toggle;
        createWidget.chatWindow = chatWindow;
        createWidget.messagesContainer = messagesContainer;
        createWidget.textarea = textarea;
        createWidget.sendBtn = sendBtn;

        // --- Sync position with back-to-top button ---
        watchBackToTop(toggle, chatWindow);
    }

    // --- Helper: Create element ---
    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        if (attrs) {
            for (var key in attrs) {
                if (key === 'className') node.className = attrs[key];
                else if (key === 'textContent') node.textContent = attrs[key];
                else if (key === 'innerHTML') node.innerHTML = attrs[key];
                else if (key.indexOf('on') === 0) node[key] = attrs[key];
                else node.setAttribute(key, attrs[key]);
            }
        }
        if (children) {
            children.forEach(function (child) {
                if (child) node.appendChild(child);
            });
        }
        return node;
    }

    // --- Toggle chat open/close ---
    function toggleChat() {
        isOpen = !isOpen;
        createWidget.toggle.classList.toggle('is-active', isOpen);
        createWidget.chatWindow.classList.toggle('is-open', isOpen);
        createWidget.toggle.setAttribute('aria-label', isOpen ? 'Close chat' : 'Open chat');

        if (isOpen) {
            setTimeout(function () {
                createWidget.textarea.focus();
            }, 300);
        }
    }

    // --- Welcome screen ---
    function showWelcome(container) {
        var welcomeMsg = el('div', { className: 'chat-widget__message chat-widget__message--bot' });
        var welcomeInner = el('div', { className: 'chat-widget__welcome' });

        var text = el('div', {
            className: 'chat-widget__welcome-text',
            innerHTML: 'Hi there! \uD83D\uDC4B I\'m the Bunnies Plumbing assistant. How can I help you today?'
        });

        var quickBtns = el('div', { className: 'chat-widget__quick-questions' });

        QUICK_QUESTIONS.forEach(function (q) {
            var btn = el('button', {
                className: 'chat-widget__quick-btn',
                type: 'button',
                textContent: q
            });
            btn.addEventListener('click', function () {
                sendQuickQuestion(q);
            });
            quickBtns.appendChild(btn);
        });

        welcomeInner.appendChild(text);
        welcomeInner.appendChild(quickBtns);
        welcomeMsg.appendChild(welcomeInner);
        container.appendChild(welcomeMsg);
    }

    // --- Send a quick question ---
    function sendQuickQuestion(question) {
        createWidget.textarea.value = question;
        sendMessage();
    }

    // --- Send message ---
    function sendMessage() {
        var textarea = createWidget.textarea;
        var message = textarea.value.trim();

        if (!message || isSending) return;

        isSending = true;
        createWidget.sendBtn.disabled = true;

        // Add user message to UI
        addMessage(message, 'user');
        textarea.value = '';
        textarea.style.height = 'auto';

        // Add to history
        conversationHistory.push({ role: 'user', content: message });

        // Show typing indicator
        var typing = showTyping();

        // Send to API
        fetch(API_PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                history: conversationHistory.slice(0, -1) // History without current message (backend adds it)
            })
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            removeTyping(typing);
            var reply = data.message || 'Please call us at ' + PHONE + ' for assistance.';
            addMessage(reply, 'bot');
            conversationHistory.push({ role: 'assistant', content: reply });
        })
        .catch(function () {
            removeTyping(typing);
            var fallback = 'I\'m having trouble connecting. Please call us at ' + PHONE + ' and we\'ll help you directly!';
            addMessage(fallback, 'bot');
            conversationHistory.push({ role: 'assistant', content: fallback });
        })
        .finally(function () {
            isSending = false;
            createWidget.sendBtn.disabled = false;
            textarea.focus();
        });
    }

    // --- Add message bubble ---
    function addMessage(text, sender) {
        var container = createWidget.messagesContainer;
        var msg = el('div', {
            className: 'chat-widget__message chat-widget__message--' + sender
        });

        // Simple markdown-like formatting for bot messages
        if (sender === 'bot') {
            msg.innerHTML = formatMessage(text);
        } else {
            msg.textContent = text;
        }

        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    // --- Format bot message (basic markdown) ---
    function formatMessage(text) {
        // Escape HTML first
        var div = document.createElement('div');
        div.textContent = text;
        var escaped = div.innerHTML;

        return escaped
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Line breaks
            .replace(/\n/g, '<br>')
            // Phone numbers as clickable links
            .replace(/\(408\)\s*427-5318/g, '<a href="tel:+14084275318" style="color:inherit;text-decoration:underline;">(408) 427-5318</a>');
    }

    // --- Typing indicator ---
    function showTyping() {
        var container = createWidget.messagesContainer;
        var typing = el('div', { className: 'chat-widget__typing' }, [
            el('span', { className: 'chat-widget__typing-dot' }),
            el('span', { className: 'chat-widget__typing-dot' }),
            el('span', { className: 'chat-widget__typing-dot' })
        ]);
        container.appendChild(typing);
        container.scrollTop = container.scrollHeight;
        return typing;
    }

    function removeTyping(typingEl) {
        if (typingEl && typingEl.parentNode) {
            typingEl.parentNode.removeChild(typingEl);
        }
    }

    // --- Sync with back-to-top button ---
    function watchBackToTop(toggle, chatWindow) {
        // Back-to-top shows at scrollY > 500 (see script.js)
        var raised = false;
        function syncPosition() {
            var shouldRaise = window.scrollY > 500;
            if (shouldRaise !== raised) {
                raised = shouldRaise;
                toggle.classList.toggle('is-raised', raised);
                chatWindow.classList.toggle('is-raised', raised);
            }
        }
        window.addEventListener('scroll', syncPosition, { passive: true });
        syncPosition(); // check initial state
    }

    // --- Initialize ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createWidget);
    } else {
        createWidget();
    }
})();
