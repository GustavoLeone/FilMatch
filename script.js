document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const elements = {
        joinSessionBtn: document.getElementById('join-session-btn'),
        startSessionBtn: document.getElementById('start-session-btn'),
        joinSessionForm: document.getElementById('join-session-form'),
        sessionContainer: document.getElementById('session'),
        sessionCodeDisplay: document.getElementById('session-code-display'),
        movieContainer: document.getElementById('movie-container'),
        likeBtn: document.getElementById('like-btn'),
        dislikeBtn: document.getElementById('dislike-btn'),
        matchResult: document.getElementById('match-result'),
        matchMovie: document.getElementById('match-movie'),
        closeSessionBtn: document.getElementById('close-session-btn'),
        joinSessionSubmitBtn: document.getElementById('join-session'),
        sessionCodeInput: document.getElementById('session-code')
    };

    // State management
    const state = {
        sessionCode: '',
        currentMovie: null,
        movieList: [],
        movieIndex: 0,
        unsubscribe: null,
        MOVIES_PER_SESSION: 50 // Numero di film per sessione
    };

    // Genera un ID utente unico
    const userID = Math.random().toString(36).substring(2, 15);

    // Event Listeners
    elements.startSessionBtn.addEventListener('click', handleStartSession);
    elements.joinSessionBtn.addEventListener('click', handleJoinSessionClick);
    elements.joinSessionSubmitBtn.addEventListener('click', handleJoinSessionSubmit);
    elements.likeBtn.addEventListener('click', () => handleVote('like'));
    elements.dislikeBtn.addEventListener('click', () => handleVote('dislike'));
    elements.closeSessionBtn.addEventListener('click', handleCloseSession);

    // Aggiungiamo un ascoltatore per chiudere il popup del match
    elements.matchResult.addEventListener('click', (e) => {
        if (e.target === elements.matchResult) {
            hideElement(elements.matchResult);
            resetToInitialState();
        }
    });

    // Session Management Functions
    async function handleStartSession() {
        try {
            state.sessionCode = generateSessionCode();
            elements.sessionCodeDisplay.textContent = state.sessionCode;
            showElement(elements.sessionContainer);
            hideElement(elements.joinSessionForm);
            
            await createSession(state.sessionCode);
            await fetchMovies();
            setupRealtimeListener();
        } catch (error) {
            console.error('Errore durante l\'avvio della sessione:', error);
            showError('Errore durante l\'avvio della sessione');
        }
    }

    function handleJoinSessionClick() {
        showElement(elements.joinSessionForm);
        hideElement(elements.sessionContainer);
    }

    async function handleJoinSessionSubmit() {
        const code = elements.sessionCodeInput.value.trim().toUpperCase();
        if (!code) {
            showError('Inserisci un codice di sessione valido');
            return;
        }
        try {
            await joinSession(code);
            setupRealtimeListener();
        } catch (error) {
            showError('Errore durante l\'accesso alla sessione');
        }
    }

    async function handleVote(voteType) {
        if (!state.sessionCode) return;
        
        try {
            await saveVote(userID, voteType);
        } catch (error) {
            showError('Errore durante il voto');
            console.error(error);
        }
    }

    function handleCloseSession() {
        if (state.unsubscribe) {
            state.unsubscribe();
        }
        hideElement(elements.sessionContainer);
        showElement(elements.joinSessionForm);
        resetState();
    }

    // Firebase Functions
    async function createSession(sessionCode) {
        try {
            await db.collection("sessions").doc(sessionCode).set({
                sessionCode,
                participants: [userID],
                currentFilm: '',
                matchFound: false,
                votes: {},
                currentMovieIndex: 0,
                selectedMovies: [] // Array per memorizzare l'ordine dei film selezionati
            });
        } catch (error) {
            console.error("Errore durante la creazione della sessione:", error);
            throw error;
        }
    }

    async function joinSession(code) {
        try {
            const sessionDoc = await db.collection("sessions").doc(code).get();
            
            if (!sessionDoc.exists) {
                showError("Sessione non trovata");
                return;
            }

            state.sessionCode = code;
            elements.sessionCodeDisplay.textContent = code;
            showElement(elements.sessionContainer);
            hideElement(elements.joinSessionForm);
            
            await db.collection("sessions").doc(code).update({
                participants: firebase.firestore.FieldValue.arrayUnion(userID)
            });
            
            // Carica i film solo se non sono già stati selezionati
            const sessionData = sessionDoc.data();
            if (sessionData.selectedMovies && sessionData.selectedMovies.length > 0) {
                state.movieList = sessionData.selectedMovies;
                loadNextMovie(sessionData.currentMovieIndex || 0);
            } else {
                await fetchMovies();
            }
        } catch (error) {
            console.error("Errore durante l'accesso alla sessione:", error);
            throw error;
        }
    }

    async function saveVote(userID, voteType) {
        try {
            const sessionRef = db.collection("sessions").doc(state.sessionCode);
            await sessionRef.update({
                [`votes.${userID}`]: voteType
            });
        } catch (error) {
            console.error("Errore durante il salvataggio del voto:", error);
            throw error;
        }
    }

    function setupRealtimeListener() {
        if (state.unsubscribe) {
            state.unsubscribe();
        }

        state.unsubscribe = db.collection("sessions")
            .doc(state.sessionCode)
            .onSnapshot(async (doc) => {
                if (!doc.exists) return;

                const data = doc.data();
                const votes = data.votes || {};
                const participants = data.participants || [];
                const allVotes = Object.values(votes);

                // Verifica se tutti i partecipanti hanno votato "like"
                if (allVotes.length === participants.length) {
                    if (allVotes.every(vote => vote === "like")) {
                        showMatchResult(state.currentMovie);
                        await doc.ref.update({ 
                            matchFound: true,
                            votes: {} 
                        });
                    } else {
                        // Se non c'è match, resetta i voti e passa al film successivo
                        await doc.ref.update({ 
                            votes: {},
                            currentMovieIndex: (data.currentMovieIndex || 0) + 1
                        });
                        loadNextMovie(data.currentMovieIndex + 1);
                    }
                }
            });
    }

    // Movie Management Functions
    async function fetchMovies() {
        try {
            // Richiediamo più pagine di film
            const moviePages = await Promise.all([
                fetch('https://api.themoviedb.org/3/movie/popular?api_key=1c84fb676472691c9a5b4301014231ec&page=1'),
                fetch('https://api.themoviedb.org/3/movie/popular?api_key=1c84fb676472691c9a5b4301014231ec&page=2'),
                fetch('https://api.themoviedb.org/3/movie/popular?api_key=1c84fb676472691c9a5b4301014231ec&page=3'),
                fetch('https://api.themoviedb.org/3/movie/popular?api_key=1c84fb676472691c9a5b4301014231ec&page=4')
            ]);

            const results = await Promise.all(moviePages.map(response => response.json()));
            
            // Combina tutti i film in un unico array
            const allMovies = results.reduce((acc, curr) => [...acc, ...curr.results], []);
            
            // Seleziona casualmente MOVIES_PER_SESSION film
            const selectedMovies = shuffleArray(allMovies).slice(0, state.MOVIES_PER_SESSION);
            
            // Salva i film selezionati nel database
            await db.collection("sessions").doc(state.sessionCode).update({
                selectedMovies: selectedMovies
            });

            state.movieList = selectedMovies;
            loadNextMovie(0);
        } catch (error) {
            console.error('Errore nel caricamento dei film:', error);
            showError('Errore nel caricamento dei film');
        }
    }

    function loadNextMovie(index) {
        if (index < state.movieList.length) {
            state.currentMovie = state.movieList[index];
            elements.movieContainer.innerHTML = `
                <img src="https://image.tmdb.org/t/p/w300${state.currentMovie.poster_path}" 
                     alt="${state.currentMovie.title}"
                     style="max-width: 100%; border-radius: 8px;">
                <h3>${state.currentMovie.title}</h3>
                <p>${state.currentMovie.overview}</p>
            `;
        } else {
            elements.movieContainer.innerHTML = '<p>Nessun altro film disponibile.</p>';
        }
    }

    function showMatchResult(movie) {
        elements.matchResult.innerHTML = `
            <div class="match-content">
                <div style="position: relative;">
                    <button class="close-match-btn" style="position: absolute; top: -10px; right: -10px; background: none; border: none; color: white; cursor: pointer; font-size: 24px;">
                        <i class="fas fa-times"></i>
                    </button>
                    <h3><i class="fas fa-star"></i> Match Trovato! <i class="fas fa-star"></i></h3>
                    <div id="match-movie">
                        <img src="https://image.tmdb.org/t/p/w300${movie.poster_path}" 
                             alt="${movie.title}"
                             style="max-width: 200px; border-radius: 8px; margin: 10px 0;">
                        <h4>${movie.title}</h4>
                        <p>${movie.overview}</p>
                    </div>
                </div>
            </div>
        `;
        
        showElement(elements.matchResult);
        
        // Aggiungi event listener per il pulsante di chiusura
        const closeBtn = elements.matchResult.querySelector('.close-match-btn');
        closeBtn.addEventListener('click', () => {
            hideElement(elements.matchResult);
            resetToInitialState();
        });
    }

    // Utility Functions
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function generateSessionCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    function showError(message) {
        const popup = document.createElement('div');
        popup.textContent = message;
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 20px;
            background-color: #ff5252;
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.6);
            z-index: 1000;
        `;
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 2000);
    }

    function showElement(element) {
        element.classList.remove('hidden');
    }

    function hideElement(element) {
        element.classList.add('hidden');
    }

    function resetState() {
        state.sessionCode = '';
        state.currentMovie = null;
        state.movieList = [];
        state.movieIndex = 0;
        if (state.unsubscribe) {
            state.unsubscribe();
            state.unsubscribe = null;
        }
    }

    function resetToInitialState() {
        hideElement(elements.sessionContainer);
        showElement(elements.joinSessionForm);
        resetState();
    }
});
