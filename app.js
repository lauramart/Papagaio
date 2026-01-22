/**
 * Papagaio - Aprenda Português
 * A modern learning tool for Portuguese vocabulary
 * With Spaced Repetition System (SRS)
 */

class PapagaioApp {
    constructor() {
        this.words = [];
        this.filteredWords = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.wordOfTheDay = null;
        this.synth = window.speechSynthesis;
        this.portugueseVoice = null;
        this.userStats = {}; // Store SRS data per word
        this.isAnimating = false; // Prevent rapid clicks during animation

        // Google Noto Animated Emoji base URL
        this.emojiBaseUrl = 'https://fonts.gstatic.com/s/e/notoemoji/latest';

        this.init();
    }

    async init() {
        await this.loadWords();
        this.loadUserStats();
        this.loadVoices();
        this.bindEvents();
        this.selectNextWord();
        this.renderLibraryGrid();
    }

    // ==========================================
    // UserStats (LocalStorage) Methods
    // ==========================================

    loadUserStats() {
        const saved = localStorage.getItem('papagaio_userStats');
        if (saved) {
            this.userStats = JSON.parse(saved);
        }
    }

    saveUserStats() {
        localStorage.setItem('papagaio_userStats', JSON.stringify(this.userStats));
    }

    getWordStats(wordId) {
        return this.userStats[wordId] || null;
    }

    /**
     * Determine estado based on maestria level
     * - nuevo: never studied (not in userStats)
     * - aprendiendo: maestria 0-2
     * - repasando: maestria 3-5
     */
    getEstado(maestria) {
        if (maestria <= 2) return 'aprendiendo';
        return 'repasando';
    }

    /**
     * Update word stats after rating
     * @param {number} wordId - Word ID
     * @param {number} rating - 0=Não sei, 1=Mais ou menos, 2=Fácil!
     */
    updateWordStats(wordId, rating) {
        const current = this.getWordStats(wordId);
        let newMaestria = current ? current.maestria : 0;

        // Calculate next review date based on rating
        let daysUntilReview;

        if (rating === 0) {
            // Não sei: reset to 0, review tomorrow
            newMaestria = 0;
            daysUntilReview = 1;
        } else if (rating === 1) {
            // Mais ou menos: +1 level, review in 2 days
            newMaestria = Math.min(5, newMaestria + 1);
            daysUntilReview = 2;
        } else if (rating === 2) {
            // Fácil!: +2 levels, review in 7 days
            newMaestria = Math.min(5, newMaestria + 2);
            daysUntilReview = 7;
        }

        // Calculate next review timestamp
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + daysUntilReview);
        nextReview.setHours(0, 0, 0, 0); // Start of day

        this.userStats[wordId] = {
            maestria: newMaestria,
            proxima_revisao: nextReview.getTime(),
            estado: this.getEstado(newMaestria)
        };

        this.saveUserStats();
        return this.userStats[wordId];
    }

    /**
     * Check if a word is due for review
     */
    isDueForReview(wordId) {
        const stats = this.getWordStats(wordId);
        if (!stats) return false; // New word, not "due"

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return stats.proxima_revisao <= now.getTime();
    }

    /**
     * Check if a word is new (never studied)
     */
    isNewWord(wordId) {
        return !this.userStats[wordId];
    }

    /**
     * Get words due for review
     */
    getDueWords() {
        return this.words.filter(word => this.isDueForReview(word.id));
    }

    /**
     * Get new words (never studied)
     */
    getNewWords() {
        return this.words.filter(word => this.isNewWord(word.id));
    }

    /**
     * Get evolution emoji based on maestria level
     * 0-1: 🌱 (Semente)
     * 2-3: 🌿 (Crescendo)
     * 4-5: 🌳 (Aprendida)
     */
    getEvolutionEmoji(maestria) {
        if (maestria <= 1) return '🌱';
        if (maestria <= 3) return '🌿';
        return '🌳';
    }

    /**
     * Get text for next review
     */
    getNextReviewText(timestamp) {
        if (!timestamp) return '';

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const reviewDate = new Date(timestamp);
        const diffMs = reviewDate - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return 'Hoje';
        if (diffDays === 1) return 'Amanhã';
        if (diffDays < 7) return `Em ${diffDays} dias`;
        if (diffDays === 7) return 'Em 1 semana';
        return `Em ${diffDays} dias`;
    }

    /**
     * Get study statistics
     */
    getStudyStats() {
        const totalWords = this.words.length;
        const studiedWords = Object.keys(this.userStats).length;
        const newWords = totalWords - studiedWords;

        let aprendiendo = 0;
        let repasando = 0;
        let dueCount = 0;

        Object.entries(this.userStats).forEach(([id, stats]) => {
            if (stats.estado === 'aprendiendo') aprendiendo++;
            else if (stats.estado === 'repasando') repasando++;

            if (this.isDueForReview(parseInt(id))) dueCount++;
        });

        return {
            total: totalWords,
            nuevo: newWords,
            aprendiendo,
            repasando,
            due: dueCount
        };
    }

    // ==========================================
    // Voice/Speech Methods
    // ==========================================

    loadVoices() {
        const setVoice = () => {
            const voices = this.synth.getVoices();
            this.portugueseVoice = voices.find(v => v.lang === 'pt-BR') ||
                                   voices.find(v => v.lang.startsWith('pt')) ||
                                   voices.find(v => v.lang === 'pt-PT');
        };

        setVoice();

        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = setVoice;
        }
    }

    speak(text, button = null) {
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        if (this.portugueseVoice) {
            utterance.voice = this.portugueseVoice;
        }

        utterance.lang = 'pt-BR';
        utterance.rate = 0.85;
        utterance.pitch = 1;

        if (button) {
            button.classList.add('playing');
            utterance.onend = () => button.classList.remove('playing');
            utterance.onerror = () => button.classList.remove('playing');
        }

        this.synth.speak(utterance);
    }

    // ==========================================
    // Data Loading Methods
    // ==========================================

    async loadWords() {
        try {
            const response = await fetch(`palabras.json?v=${Date.now()}`);
            const data = await response.json();
            this.words = data.palabras;
            this.filteredWords = [...this.words];
        } catch (error) {
            console.error('Error loading words:', error);
        }
    }

    // ==========================================
    // Image/Emoji Methods
    // ==========================================

    getGifFromWord(word) {
        if (word.gifUrl) return word.gifUrl;
        if (word.emoji) {
            return `${this.emojiBaseUrl}/${word.emoji}/512.gif`;
        }
        return this.getPlaceholder(word.palavra);
    }

    getPlaceholder(text) {
        const letter = text.charAt(0).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
            <rect width="200" height="200" fill="#1a1a1a"/>
            <text x="100" y="115" font-family="Inter, sans-serif" font-size="80" font-weight="bold" fill="#22c55e" text-anchor="middle">${letter}</text>
        </svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    getTwemojiFallback(emoji) {
        return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/${emoji}.svg`;
    }

    handleImageError(img, word) {
        const currentSrc = img.src;

        if (currentSrc.includes('fonts.gstatic.com') && word.emoji) {
            img.src = this.getTwemojiFallback(word.emoji);
            return;
        }

        img.src = this.getPlaceholder(word.palavra);
    }

    // ==========================================
    // Event Binding
    // ==========================================

    bindEvents() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchSection(btn.dataset.section);
            });
        });

        // Featured card flip
        document.getElementById('featured-card').addEventListener('click', (e) => {
            if (e.target.closest('.audio-btn') || e.target.closest('.rating-btn')) return;
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
            this.selectNextWord(true);
        });

        // Rating buttons
        document.querySelectorAll('#featured-difficulty-rating .rating-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rating = parseInt(btn.dataset.rating);
                this.handleRating(rating);
            });
        });

        // Practice anyway button
        document.getElementById('practice-anyway-btn').addEventListener('click', () => {
            this.showRandomWord();
        });

        // Modal audio button
        document.getElementById('modal-audio').addEventListener('click', (e) => {
            e.stopPropagation();
            const word = document.getElementById('modal-word').textContent;
            this.speak(word, e.currentTarget);
        });

        // Search input
        const searchInput = document.getElementById('search-input');
        const searchClear = document.getElementById('search-clear');

        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase().trim();
            searchClear.style.display = this.searchQuery ? 'flex' : 'none';
            this.applyFilters();
        });

        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            this.searchQuery = '';
            searchClear.style.display = 'none';
            this.applyFilters();
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
            // Number keys for rating (1=Errei, 2=Bom, 3=Fácil)
            if (this.wordOfTheDay && document.getElementById('featured-card').classList.contains('flipped') && !this.isAnimating) {
                if (e.key === '1') this.handleRating(0); // Errei
                if (e.key === '2') this.handleRating(1); // Bom
                if (e.key === '3') this.handleRating(2); // Fácil
            }
        });
    }

    // ==========================================
    // Rating Handler
    // ==========================================

    handleRating(rating) {
        if (!this.wordOfTheDay || this.isAnimating) return;
        this.isAnimating = true;

        // Update stats
        const updatedStats = this.updateWordStats(this.wordOfTheDay.id, rating);

        // Visual feedback - highlight selected button
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (parseInt(btn.dataset.rating) === rating) {
                btn.classList.add('selected');
            }
        });

        // Update evolution emoji
        const evolutionEmoji = this.getEvolutionEmoji(updatedStats.maestria);
        document.getElementById('featured-evolution-front').textContent = evolutionEmoji;
        document.getElementById('featured-evolution-back').textContent = evolutionEmoji;

        // Swipe animation based on rating
        const card = document.getElementById('featured-card');
        let swipeClass;
        if (rating === 0) {
            swipeClass = 'swipe-left'; // Errei - swipe left
        } else if (rating === 1) {
            swipeClass = 'swipe-up'; // Bom - swipe up
        } else {
            swipeClass = 'swipe-right'; // Fácil - swipe right
        }

        card.classList.add(swipeClass);

        // Update library grid
        this.renderLibraryGrid();

        // After animation, load next word
        setTimeout(() => {
            card.classList.remove(swipeClass, 'flipped');
            this.isAnimating = false;

            // If "Errei", show the same word again immediately
            if (rating === 0) {
                this.showWord(this.wordOfTheDay);
            } else {
                this.selectNextWord();
            }
        }, 450);
    }

    // ==========================================
    // Learned Check (maestria >= 5)
    // ==========================================

    isLearned(wordId) {
        const stats = this.getWordStats(wordId);
        return stats && stats.maestria >= 5;
    }

    // ==========================================
    // Section/Navigation
    // ==========================================

    switchSection(sectionId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });

        document.querySelectorAll('.section').forEach(section => {
            section.classList.toggle('active', section.id === sectionId);
        });

        // Re-render library grid when switching to biblioteca
        if (sectionId === 'biblioteca') {
            this.renderLibraryGrid();
        }
    }

    // ==========================================
    // Word Selection (Smart Algorithm)
    // ==========================================

    selectNextWord(forceNew = false) {
        if (this.words.length === 0) return;

        // Priority 1: Words due for review
        const dueWords = this.getDueWords();
        if (dueWords.length > 0) {
            // Sort by oldest due date first
            dueWords.sort((a, b) => {
                const statsA = this.getWordStats(a.id);
                const statsB = this.getWordStats(b.id);
                return (statsA?.proxima_revisao || 0) - (statsB?.proxima_revisao || 0);
            });

            // Pick from top candidates with some randomness
            const topCandidates = dueWords.slice(0, Math.min(3, dueWords.length));
            const word = topCandidates[Math.floor(Math.random() * topCandidates.length)];

            this.showWord(word);
            return;
        }

        // Priority 2: New words (never studied)
        const newWords = this.getNewWords();
        if (newWords.length > 0) {
            const word = newWords[Math.floor(Math.random() * newWords.length)];
            this.showWord(word);
            return;
        }

        // Priority 3: All caught up - show message
        this.showAllDoneMessage();
    }

    showWord(word) {
        // Hide "all done" message and show card
        document.getElementById('all-done-container').style.display = 'none';
        document.querySelector('.featured-card-container').style.display = 'flex';

        this.wordOfTheDay = word;
        this.renderFeaturedCard(word);
    }

    showRandomWord() {
        // For "practice anyway" button
        const randomIndex = Math.floor(Math.random() * this.words.length);
        const word = this.words[randomIndex];
        this.showWord(word);
    }

    showAllDoneMessage() {
        this.wordOfTheDay = null;

        // Hide card and show "all done" message
        document.querySelector('.featured-card-container').style.display = 'none';
        document.getElementById('all-done-container').style.display = 'flex';

        // Update stats
        const stats = this.getStudyStats();
        const statsEl = document.getElementById('all-done-stats');
        statsEl.innerHTML = `
            <strong>${stats.total}</strong> palavras no total ·
            <strong>${stats.nuevo}</strong> novas ·
            <strong>${stats.aprendiendo}</strong> aprendendo ·
            <strong>${stats.repasando}</strong> repasando
        `;
    }

    // ==========================================
    // Rendering Methods
    // ==========================================

    renderFeaturedCard(word) {
        // Reset flip state and rating selection
        document.getElementById('featured-card').classList.remove('flipped');
        document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));

        // Front (O Desafio) - Minimalist, only word + audio
        const displayWord = word.artigo ? `${word.artigo} ${word.palavra}` : word.palavra;
        document.getElementById('featured-word').textContent = displayWord;

        // Show plural on front if available
        const pluralElement = document.getElementById('featured-plural');
        if (word.plural && word.artigoPlural) {
            pluralElement.textContent = `(${word.artigoPlural} ${word.plural})`;
            pluralElement.style.display = 'block';
        } else {
            pluralElement.style.display = 'none';
        }

        const typeElement = document.getElementById('featured-type');
        typeElement.textContent = word.tipo;
        typeElement.className = `card-badge ${word.tipo}`;

        // Back (A Resposta) - The Reward with image
        const gifUrl = this.getGifFromWord(word);
        const featuredImg = document.getElementById('featured-image');
        featuredImg.src = gifUrl;
        featuredImg.alt = word.palavra;
        featuredImg.onerror = () => this.handleImageError(featuredImg, word);

        // Back word and description
        document.getElementById('featured-back-word').textContent = displayWord;
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

        // SRS: Render evolution emoji
        const stats = this.getWordStats(word.id);
        const maestria = stats ? stats.maestria : 0;
        const evolutionEmoji = this.getEvolutionEmoji(maestria);

        document.getElementById('featured-evolution-front').textContent = evolutionEmoji;
        document.getElementById('featured-evolution-back').textContent = evolutionEmoji;

        // SRS: Show next review info
        const nextReviewEl = document.getElementById('featured-next-review');
        if (stats) {
            nextReviewEl.textContent = '';
        } else {
            nextReviewEl.textContent = 'Palavra nova!';
        }
    }

    renderLibraryGrid() {
        const grid = document.getElementById('words-grid');
        grid.innerHTML = '';

        this.filteredWords.forEach(word => {
            const card = document.createElement('div');
            const stats = this.getWordStats(word.id);
            const isDue = this.isDueForReview(word.id);
            const maestria = stats ? stats.maestria : 0;

            let cardClasses = 'word-card';
            if (isDue) cardClasses += ' due-review';

            card.className = cardClasses;
            const gifUrl = this.getGifFromWord(word);
            const displayWord = word.artigo ? `${word.artigo} ${word.palavra}` : word.palavra;
            const genderBadge = word.genero ? `<span class="gender-badge ${word.genero}">${word.genero === 'masculino' ? '♂' : '♀'}</span>` : '';
            const dueBadge = isDue ? `<span class="due-badge">Revisar</span>` : '';

            // Evolution emoji
            const evolutionEmoji = this.getEvolutionEmoji(maestria);

            const pluralHtml = word.plural && word.artigoPlural
                ? `<p class="word-card-plural">${word.artigoPlural} ${word.plural}</p>`
                : '';

            card.innerHTML = `
                <span class="evolution-badge">${evolutionEmoji}</span>
                ${dueBadge}
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

        // Update learned count (maestria >= 5)
        const learnedInFilter = this.filteredWords.filter(w => this.isLearned(w.id)).length;
        const learnedCountEl = document.getElementById('learned-count');
        if (learnedCountEl) {
            learnedCountEl.textContent = learnedInFilter;
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;

        document.querySelectorAll('.filters-bar .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.applyFilters();
    }

    applyFilters() {
        // Start with all words
        let results = [...this.words];

        // Apply category filter
        if (this.currentFilter !== 'all') {
            results = results.filter(word => word.tipo === this.currentFilter);
        }

        // Apply search query
        if (this.searchQuery) {
            results = results.filter(word => {
                const searchIn = [
                    word.palavra,
                    word.descricao,
                    word.artigo || '',
                    word.plural || ''
                ].join(' ').toLowerCase();
                return searchIn.includes(this.searchQuery);
            });
        }

        this.filteredWords = results;
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
