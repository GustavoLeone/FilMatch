console.log('Script caricato');
// Unique ID generator for users
const userID = Math.random().toString(36).substring(2, 15);

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
        movieIndex: 0
    };

    // Event Listeners
    elements.startSessionBtn.addEventListener('click', handleStartSession);
    elements.joinSessionBtn.addEventListener('click', handleJoinSessionClick);
    elements.joinSessionSubmitBtn.addEventListener('click', handleJoinSessionSubmit);
    elements.likeBtn.addEventListener('click', () => handleVote('like'));
    elements.dislikeBtn.addEventListener('click', () => handleVote('dislike'));
    elements.closeSessionBtn.addEventListener('click', handleCloseSession);

    // Session Management Functions
    async function handleStartSession() {
        state.sessionCode = generateSessionCode();
        elements.sessionCodeDisplay.textContent = state.sessionCode;
        showElement(elements.sessionContainer);
        hideElement(elements.joinSessionForm);
        
        try {
            await createSession(state.sessionCode);
            await fetchMovies();
        } catch (error) {
            showError('Errore durante l\'avvio della sessione');
            console.error(error);
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
        await joinSession(code);
    }

    async function handleVote(voteType) {
        try {
            await saveVote(userID, voteType);
            await checkMatch();
        } catch (error) {
            showError('Errore durante il voto');
            console.error(error);
        }
    }

    function handleCloseSession() {
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
                votes: {}
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
            showError("Errore durante l'accesso alla sessione");
        }
    }

    async function saveVote(userID, voteType) {
        try {
            const sessionRef = db.collection("sessions").doc(state.sessionCode);
            const sessionDoc = await sessionRef.get();
            
            if (sessionDoc.exists) {
                const votes = sessionDoc.data().votes || {};
                votes[userID] = voteType;
                await sessionRef.update({ votes });
            }
        } catch (error) {
            console.error("Errore durante il salvataggio del voto:", error);
            throw error;
        }
    }

    async function checkMatch() {
        try {
            const sessionRef = db.collection("sessions").doc(state.sessionCode);
            const sessionDoc = await sessionRef.get();
            
            if (sessionDoc.exists) {
                const data = sessionDoc.data();
                const votes = data.votes || {};
                const participants = data.participants || [];
                const allVotes = Object.values(votes);
                
                if (allVotes.length === participants.length && allVotes.every(vote => vote === "like")) {
                    showElement(elements.matchResult);
                    elements.matchMovie.innerHTML = `Match! Film: ${state.currentMovie.title}`;
                    await sessionRef.update({ 
                        matchFound: true,
                        votes: {} // Reset votes after match
                    });
                } else if (allVotes.length === participants.length) {
                    await sessionRef.update({ votes: {} }); // Reset votes
                    loadNextMovie();
                }
            }
        } catch (error) {
            console.error("Errore durante la verifica del match:", error);
            throw error;
        }
    }

    // Movie Management Functions
    async function fetchMovies() {
        try {
            const response = await fetch('https://api.themoviedb.org/3/movie/popular?api_key=1c84fb676472691c9a5b4301014231ec', {
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxYzg0ZmI2NzY0NzI2OTFjOWE1YjQzMDEwMTQyMzFlYyIsInN1YiI6IjY1OWVmYTBiOGRlMGFlMDE1OWI5NTc1YSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.fGZJvxS-wvgEeGH3DbLkUAEWJF5Zzb-2Bl9aVQQGLPw',
                    'accept': 'application/json'
                }
            });
            console.log('Risposta API:', response);
            const data = await response.json();
            console.log('Dati film:', data);
            state.movieList = data.results;
            state.movieIndex = 0;
            loadNextMovie();
        } catch (error) {
            console.error('Errore nel caricamento dei film:', error);
            showError('Errore nel caricamento dei film');
        }
    }

    function loadNextMovie() {
        if (state.movieIndex < state.movieList.length) {
            state.currentMovie = state.movieList[state.movieIndex];
            elements.movieContainer.innerHTML = `
                <img src="https://image.tmdb.org/t/p/w300${state.currentMovie.poster_path}" 
                     alt="${state.currentMovie.title}"
                     style="max-width: 100%; border-radius: 8px;">
                <h3>${state.currentMovie.title}</h3>
                <p>${state.currentMovie.overview}</p>
            `;
            updateCurrentFilmInDB(state.currentMovie.title);
            state.movieIndex++;
        } else {
            elements.movieContainer.innerHTML = '<p>Nessun altro film disponibile.</p>';
        }
    }

    async function updateCurrentFilmInDB(movieTitle) {
        try {
            await db.collection("sessions").doc(state.sessionCode).update({
                currentFilm: movieTitle
            });
        } catch (error) {
            console.error('Errore nell\'aggiornamento del film corrente:', error);
            showError('Errore nell\'aggiornamento del film');
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
    }
});
