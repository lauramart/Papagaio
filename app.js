/**
 * Papagaio - Aprenda Português
 * A modern learning tool for Portuguese vocabulary
 */

class PapagaioApp {
    constructor() {
        this.words = [];
        this.filteredWords = [];
        this.currentFilter = 'all';
        this.wordOfTheDay = null;
        this.synth = window.speechSynthesis;
        this.portugueseVoice = null;
        this.learnedWords = new Set();

        // Google Noto Animated Emoji base URL
        this.emojiBaseUrl = 'https://fonts.gstatic.com/s/e/notoemoji/latest';

        this.init();
    }

    async init() {
        await this.loadWords();
        this.loadLearnedWords();
        this.loadVoices();
        this.bindEvents();
        this.setWordOfTheDay();
        this.renderLibraryGrid();
    }

    loadLearnedWords() {
        const saved = localStorage.getItem('learnedWords');
        if (saved) {
            this.learnedWords = new Set(JSON.parse(saved));
        }
    }

    saveLearnedWords() {
        localStorage.setItem('learnedWords', JSON.stringify([...this.learnedWords]));
    }

    toggleLearned(wordId) {
        if (this.learnedWords.has(wordId)) {
            this.learnedWords.delete(wordId);
        } else {
            this.learnedWords.add(wordId);
        }
        this.saveLearnedWords();
        this.renderLibraryGrid();
        this.updateModalLearnedState(wordId);
    }

    isLearned(wordId) {
        return this.learnedWords.has(wordId);
    }

    updateModalLearnedState(wordId) {
        const btn = document.getElementById('modal-learned-btn');
        if (btn && btn.dataset.wordId == wordId) {
            const isLearned = this.isLearned(wordId);
            btn.classList.toggle('learned', isLearned);
            btn.innerHTML = isLearned
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Aprendida`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Marcar como aprendida`;
        }
    }

    updateFeaturedLearnedState() {
        if (!this.wordOfTheDay) return;
        const btn = document.getElementById('featured-learned-btn');
        const isLearned = this.isLearned(this.wordOfTheDay.id);
        btn.classList.toggle('learned', isLearned);
        btn.innerHTML = isLearned
            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Aprendida`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Marcar como aprendida`;
    }

    loadVoices() {
        // Load voices - may need to wait for them to be available
        const setVoice = () => {
            const voices = this.synth.getVoices();
            // Try to find Portuguese Brazilian voice first, then any Portuguese
            this.portugueseVoice = voices.find(v => v.lang === 'pt-BR') ||
                                   voices.find(v => v.lang.startsWith('pt')) ||
                                   voices.find(v => v.lang === 'pt-PT');
        };

        setVoice();

        // Chrome loads voices asynchronously
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = setVoice;
        }
    }

    speak(text, button = null) {
        // Cancel any ongoing speech
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        if (this.portugueseVoice) {
            utterance.voice = this.portugueseVoice;
        }

        utterance.lang = 'pt-BR';
        utterance.rate = 0.85; // Slightly slower for learning
        utterance.pitch = 1;

        // Visual feedback
        if (button) {
            button.classList.add('playing');
            utterance.onend = () => button.classList.remove('playing');
            utterance.onerror = () => button.classList.remove('playing');
        }

        this.synth.speak(utterance);
    }

    async loadWords() {
        try {
            // Add cache buster to force reload
            const response = await fetch(`palabras.json?v=${Date.now()}`);
            const data = await response.json();
            this.words = data.palabras;
            this.filteredWords = [...this.words];

            } catch (error) {
            console.error('Error loading words:', error);
        }
    }

    getGifFromWord(word) {
        // Use gifUrl if available
        if (word.gifUrl) return word.gifUrl;

        // Generate URL from emoji code
        if (word.emoji) {
            return `${this.emojiBaseUrl}/${word.emoji}/512.gif`;
        }

        // Fallback placeholder
        return this.getPlaceholder(word.palavra);
    }

    getPlaceholder(text) {
        // Create a data URL with the first letter as placeholder
        const letter = text.charAt(0).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
            <rect width="200" height="200" fill="#1a1a1a"/>
            <text x="100" y="115" font-family="Inter, sans-serif" font-size="80" font-weight="bold" fill="#22c55e" text-anchor="middle">${letter}</text>
        </svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    getTwemojiFallback(emoji) {
        // Twemoji CDN fallback
        return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/${emoji}.svg`;
    }

    handleImageError(img, word) {
        const currentSrc = img.src;

        // If Google Noto failed, try Twemoji
        if (currentSrc.includes('fonts.gstatic.com') && word.emoji) {
            img.src = this.getTwemojiFallback(word.emoji);
            return;
        }

        // If Twemoji failed, use placeholder
        img.src = this.getPlaceholder(word.palavra);
    }

    bindEvents() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchSection(btn.dataset.section);
            });
        });

        // Featured card flip
        document.getElementById('featured-card').addEventListener('click', (e) => {
            // Don't flip if clicking audio button
            if (e.target.closest('.audio-btn')) return;
            document.getElementById('featured-card').classList.toggle('flipped');
        });

        // Featured audio button
        document.getElementById('featured-audio').addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.wordOfTheDay) {
                this.speak(this.wordOfTheDay.palavra, e.currentTarget);
            }
        });

        // Refresh word of the day
        document.getElementById('refresh-word').addEventListener('click', (e) => {
            e.stopPropagation();
            this.setWordOfTheDay(true);
        });

        // Learned button in featured card
        document.getElementById('featured-learned-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.wordOfTheDay) {
                this.toggleLearned(this.wordOfTheDay.id);
                this.updateFeaturedLearnedState();
            }
        });

        // Modal audio button
        document.getElementById('modal-audio').addEventListener('click', (e) => {
            e.stopPropagation();
            const word = document.getElementById('modal-word').textContent;
            this.speak(word, e.currentTarget);
        });

        // Library filters
        document.querySelectorAll('.filters-bar .filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setFilter(btn.dataset.filter);
            });
        });

        // Modal close
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-overlay')) {
                this.closeModal();
            }
        });

        // Learned button in modal
        document.getElementById('modal-learned-btn').addEventListener('click', (e) => {
            const wordId = parseInt(e.currentTarget.dataset.wordId);
            this.toggleLearned(wordId);
        });

        // Tense selectors
        const featuredTenseSelector = document.getElementById('featured-tense-selector');
        featuredTenseSelector.addEventListener('click', (e) => e.stopPropagation());
        featuredTenseSelector.addEventListener('change', (e) => {
            e.stopPropagation();
            if (this.currentFeaturedConjugacoes) {
                document.getElementById('featured-conjugations-grid').innerHTML =
                    this.renderConjugationTable(this.currentFeaturedConjugacoes, e.target.value);
            }
        });

        document.getElementById('modal-tense-selector').addEventListener('change', (e) => {
            if (this.currentModalConjugacoes) {
                document.getElementById('modal-conjugations-grid').innerHTML =
                    this.renderConjugationTable(this.currentModalConjugacoes, e.target.value);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
            if (e.key === ' ' && !document.getElementById('modal-overlay').classList.contains('active')) {
                const activeSection = document.querySelector('.section.active');
                if (activeSection.id === 'palavra-do-dia') {
                    e.preventDefault();
                    document.getElementById('featured-card').classList.toggle('flipped');
                }
            }
        });
    }

    switchSection(sectionId) {
        // Update tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });

        // Update sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.toggle('active', section.id === sectionId);
        });
    }

    setWordOfTheDay(forceNew = false) {
        if (this.words.length === 0) return;

        let word;

        if (!forceNew) {
            // Try to get saved word of the day
            const saved = localStorage.getItem('wordOfTheDay');
            const savedDate = localStorage.getItem('wordOfTheDayDate');
            const today = new Date().toDateString();

            if (saved && savedDate === today) {
                const savedId = parseInt(saved);
                word = this.words.find(w => w.id === savedId);
            }
        }

        if (!word) {
            // Select random word
            const randomIndex = Math.floor(Math.random() * this.words.length);
            word = this.words[randomIndex];

            // Save for today
            localStorage.setItem('wordOfTheDay', word.id.toString());
            localStorage.setItem('wordOfTheDayDate', new Date().toDateString());
        }

        this.wordOfTheDay = word;
        this.renderFeaturedCard(word);
    }

    renderFeaturedCard(word) {
        // Reset flip state
        document.getElementById('featured-card').classList.remove('flipped');

        // Front - Use GIF
        const gifUrl = this.getGifFromWord(word);
        const featuredImg = document.getElementById('featured-image');
        featuredImg.src = gifUrl;
        featuredImg.alt = word.palavra;
        featuredImg.onerror = () => this.handleImageError(featuredImg, word);

        // Show article + word for objects with gender
        const displayWord = word.artigo ? `${word.artigo} ${word.palavra}` : word.palavra;
        document.getElementById('featured-word').textContent = displayWord;

        // Show plural if available
        const pluralElement = document.getElementById('featured-plural');
        if (word.plural && word.artigoPlural) {
            pluralElement.innerHTML = `Plural: <span>${word.artigoPlural} ${word.plural}</span>`;
            pluralElement.style.display = 'block';
        } else {
            pluralElement.style.display = 'none';
        }

        document.getElementById('featured-front-description').textContent = word.descricao;

        const typeElement = document.getElementById('featured-type');
        typeElement.textContent = word.tipo;
        typeElement.className = `card-badge ${word.tipo}`;

        // Back
        const backDisplayWord = word.artigo ? `${word.artigo} ${word.palavra}` : word.palavra;
        document.getElementById('featured-back-word').textContent = backDisplayWord;

        // Show plural on back too
        const backPluralElement = document.getElementById('featured-back-plural');
        if (word.plural && word.artigoPlural) {
            backPluralElement.innerHTML = `Plural: <span>${word.artigoPlural} ${word.plural}</span>`;
            backPluralElement.style.display = 'block';
        } else {
            backPluralElement.style.display = 'none';
        }

        document.getElementById('featured-description').textContent = word.descricao;

        // Conjugations
        const conjugationsContainer = document.getElementById('featured-conjugations');
        const conjugationsGrid = document.getElementById('featured-conjugations-grid');
        const tenseSelector = document.getElementById('featured-tense-selector');

        if (word.tipo === 'verbo' && word.conjugacoes) {
            conjugationsContainer.style.display = 'block';
            tenseSelector.value = 'presente_indicativo';
            this.currentFeaturedConjugacoes = word.conjugacoes;
            conjugationsGrid.innerHTML = this.renderConjugationTable(word.conjugacoes, 'presente_indicativo');
        } else {
            conjugationsContainer.style.display = 'none';
            this.currentFeaturedConjugacoes = null;
        }

        // Examples
        document.getElementById('featured-examples').innerHTML = word.exemplos
            .map(ex => `<li>${ex}</li>`)
            .join('');

        // Update learned button state
        this.updateFeaturedLearnedState();
    }

    renderLibraryGrid() {
        const grid = document.getElementById('words-grid');
        grid.innerHTML = '';

        this.filteredWords.forEach(word => {
            const card = document.createElement('div');
            const isLearned = this.isLearned(word.id);
            card.className = `word-card${isLearned ? ' learned' : ''}`;
            const gifUrl = this.getGifFromWord(word);
            const displayWord = word.artigo ? `${word.artigo} ${word.palavra}` : word.palavra;
            const genderBadge = word.genero ? `<span class="gender-badge ${word.genero}">${word.genero === 'masculino' ? '♂' : '♀'}</span>` : '';
            const learnedBadge = isLearned ? `<span class="learned-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg></span>` : '';

            const pluralHtml = word.plural && word.artigoPlural
                ? `<p class="word-card-plural">${word.artigoPlural} ${word.plural}</p>`
                : '';

            card.innerHTML = `
                ${learnedBadge}
                <img src="${gifUrl}" alt="${word.palavra}" class="word-card-image">
                <div class="word-card-content">
                    <div class="word-card-header">
                        <h3 class="word-card-word">${displayWord}</h3>
                        <button class="word-card-audio" aria-label="Ouvir pronúncia" data-word="${word.palavra}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            </svg>
                        </button>
                    </div>
                    ${pluralHtml}
                    <div class="word-card-meta">
                        <span class="word-card-type ${word.tipo}">${word.tipo}</span>
                        ${genderBadge}
                    </div>
                </div>
            `;

            // Image error handling
            const cardImg = card.querySelector('.word-card-image');
            cardImg.onerror = () => this.handleImageError(cardImg, word);

            // Audio button click
            const audioBtn = card.querySelector('.word-card-audio');
            audioBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.speak(word.palavra, e.currentTarget);
            });

            // Card click opens modal
            card.addEventListener('click', () => {
                this.openModal(word);
            });

            grid.appendChild(card);
        });

        // Update counts
        document.getElementById('filtered-count').textContent = this.filteredWords.length;

        // Update learned count
        const learnedInFilter = this.filteredWords.filter(w => this.isLearned(w.id)).length;
        const learnedCountEl = document.getElementById('learned-count');
        if (learnedCountEl) {
            learnedCountEl.textContent = learnedInFilter;
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;

        // Update active button
        document.querySelectorAll('.filters-bar .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        // Filter words
        if (filter === 'all') {
            this.filteredWords = [...this.words];
        } else {
            this.filteredWords = this.words.filter(word => word.tipo === filter);
        }

        this.renderLibraryGrid();
    }

    openModal(word) {
        const gifUrl = this.getGifFromWord(word);
        const modalImg = document.getElementById('modal-image');
        modalImg.src = gifUrl;
        modalImg.alt = word.palavra;
        modalImg.onerror = () => this.handleImageError(modalImg, word);

        const displayWord = word.artigo ? `${word.artigo} ${word.palavra}` : word.palavra;
        document.getElementById('modal-word').textContent = displayWord;

        // Show plural in modal
        const modalPluralElement = document.getElementById('modal-plural');
        if (word.plural && word.artigoPlural) {
            modalPluralElement.textContent = `Plural: ${word.artigoPlural} ${word.plural}`;
            modalPluralElement.style.display = 'block';
        } else {
            modalPluralElement.style.display = 'none';
        }

        document.getElementById('modal-description').textContent = word.descricao;

        const typeElement = document.getElementById('modal-type');
        typeElement.textContent = word.tipo;
        typeElement.className = `card-badge ${word.tipo}`;

        // Conjugations
        const conjugationsContainer = document.getElementById('modal-conjugations');
        const conjugationsGrid = document.getElementById('modal-conjugations-grid');
        const tenseSelector = document.getElementById('modal-tense-selector');

        if (word.tipo === 'verbo' && word.conjugacoes) {
            conjugationsContainer.style.display = 'block';
            tenseSelector.value = 'presente_indicativo';
            this.currentModalConjugacoes = word.conjugacoes;
            conjugationsGrid.innerHTML = this.renderConjugationTable(word.conjugacoes, 'presente_indicativo');
        } else {
            conjugationsContainer.style.display = 'none';
            this.currentModalConjugacoes = null;
        }

        // Examples
        document.getElementById('modal-examples').innerHTML = word.exemplos
            .map(ex => `<li>${ex}</li>`)
            .join('');

        // Learned button
        const learnedBtn = document.getElementById('modal-learned-btn');
        learnedBtn.dataset.wordId = word.id;
        const isLearned = this.isLearned(word.id);
        learnedBtn.classList.toggle('learned', isLearned);
        learnedBtn.innerHTML = isLearned
            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Aprendida`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Marcar como aprendida`;

        document.getElementById('modal-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    renderConjugationTable(conjugacoes, tense = 'presente_indicativo') {
        const pronouns = [
            { key: 'eu', label: 'Eu' },
            { key: 'tu', label: 'Tu' },
            { key: 'ele_ela_voce', label: 'Ele/Ela/Você' },
            { key: 'nos', label: 'Nós' },
            { key: 'vos', label: 'Vós' },
            { key: 'eles_elas_voces', label: 'Eles/Elas/Vocês' }
        ];

        let html = '<div class="conjugation-list">';
        pronouns.forEach(pronoun => {
            const value = conjugacoes[tense]?.[pronoun.key] || '-';
            html += `<div class="conjugation-item">
                <span class="pronoun">${pronoun.label}</span>
                <span class="conjugation-value">${value}</span>
            </div>`;
        });
        html += '</div>';

        return html;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PapagaioApp();
});
