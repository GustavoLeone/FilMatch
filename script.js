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
        unsubscribe: null // Per gestire l'unsubscribe dal listener di Firestore
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
                currentMovieIndex: 0
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
            
            await fetchMovies();
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
                        showElement(elements.matchResult);
                        elements.matchMovie.innerHTML = `Match! Film: ${state.currentMovie.title}`;
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
            const response = await fetch('https://api.themoviedb.org/3/movie/popular?api_key=1c84fb676472691c9a5b4301014231ec');
            const data = await response.json();
            state.movieList = data.results;
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

    // Utility Functions
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
});
