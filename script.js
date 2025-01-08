document.addEventListener('DOMContentLoaded', function () {
    // Riferimenti ai pulsanti e contenitori
    const joinSessionBtn = document.getElementById('join-session-btn');
    const startSessionBtn = document.getElementById('start-session-btn');
    const joinSessionForm = document.getElementById('join-session-form');
    const sessionContainer = document.getElementById('session');
    const sessionCodeDisplay = document.getElementById('session-code-display');
    const movieContainer = document.getElementById('movie-container');
    const likeBtn = document.getElementById('like-btn');
    const dislikeBtn = document.getElementById('dislike-btn');
    const matchResult = document.getElementById('match-result');
    const matchMovie = document.getElementById('match-movie');
    const closeSessionBtn = document.getElementById('close-session-btn');

    let sessionCode = '';
    let currentMovie = null;
    let userVotes = [];
    let movieList = [];
    let movieIndex = 0;

    // Gestione pulsanti iniziali
    startSessionBtn.addEventListener('click', () => {
        sessionCode = generateSessionCode();
        sessionCodeDisplay.textContent = sessionCode;
        sessionContainer.classList.remove('hidden');
        joinSessionForm.classList.add('hidden');
        createSession(sessionCode); // Crea una sessione su Firebase
        fetchMovies(); // Carica i film all'inizio della sessione
        listenToSessionUpdates(); // Aggiungi il listener per aggiornamenti in tempo reale
    });

    joinSessionBtn.addEventListener('click', () => {
        joinSessionForm.classList.remove('hidden');
        sessionContainer.classList.add('hidden');
    });

    // Gestione del form per unirsi a una sessione
    document.getElementById('join-session').addEventListener('click', () => {
        const code = document.getElementById('session-code').value;
        if (code === '') {
            alert('Inserisci un codice di sessione.');
            return;
        }
        joinSession(code); // Unisciti alla sessione
    });

    // Gestione dei pulsanti di like/dislike
    likeBtn.addEventListener('click', () => {
        handleVote('like');
    });

    dislikeBtn.addEventListener('click', () => {
        handleVote('dislike');
    });

    // Gestione della chiusura della sessione
    closeSessionBtn.addEventListener('click', () => {
        sessionContainer.classList.add('hidden');
        joinSessionForm.classList.remove('hidden');
        userVotes = [];
    });

    // Funzione per generare il codice sessione
    function generateSessionCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Funzione per creare una nuova sessione su Firebase
    async function createSession(sessionCode) {
        try {
            const sessionRef = doc(db, "sessions", sessionCode);
            await setDoc(sessionRef, {
                sessionCode: sessionCode,
                participants: [],
                currentFilm: '',
                matchFound: false,
                votes: [], // Array per voti in tempo reale
            });
        } catch (error) {
            console.error("Errore durante la creazione della sessione: ", error);
        }
    }

    // Funzione per unirsi a una sessione esistente
    async function joinSession(code) {
        try {
            const sessionRef = doc(db, "sessions", code);
            const sessionSnapshot = await getDoc(sessionRef);
            if (sessionSnapshot.exists()) {
                sessionCode = code;
                sessionCodeDisplay.textContent = sessionCode;
                sessionContainer.classList.remove('hidden');
                joinSessionForm.classList.add('hidden');
                updateSessionParticipants(code);
                listenToSessionUpdates(); // Aggiungi il listener per aggiornamenti in tempo reale
            } else {
                alert('Sessione non esistente');
            }
        } catch (error) {
            console.error("Errore durante l'unione alla sessione: ", error);
        }
    }

    // Funzione per aggiornare la lista dei partecipanti in Firebase
    async function updateSessionParticipants(code) {
        const sessionRef = doc(db, "sessions", code);
        await updateDoc(sessionRef, {
            participants: arrayUnion(sessionCode)
        });
    }

    // Listener per aggiornamenti in tempo reale sulla sessione
    function listenToSessionUpdates() {
        const sessionRef = doc(db, "sessions", sessionCode);

        onSnapshot(sessionRef, (snapshot) => {
            const sessionData = snapshot.data();
            if (sessionData) {
                if (sessionData.currentFilm !== currentMovie?.title) {
                    // Aggiorna il film corrente
                    currentMovie = { title: sessionData.currentFilm };
                    movieContainer.innerHTML = `<h3>${currentMovie.title}</h3>`;
                }

                if (sessionData.matchFound) {
                    // Mostra il match
                    matchResult.classList.remove('hidden');
                    matchMovie.textContent = `Match! Film: ${currentMovie.title}`;
                }
            }
        });
    }

    // Funzione per recuperare i film
    function fetchMovies() {
        fetch('https://api.themoviedb.org/3/movie/popular?api_key=1c84fb676472691c9a5b4301014231ec')
            .then(response => response.json())
            .then(data => {
                movieList = data.results; // Salva la lista dei film
                movieIndex = 0; // Resetta l'indice
                loadNextMovie(); // Mostra il primo film
            })
            .catch(error => console.log('Errore nel recupero dei film:', error));
    }

    // Funzione per caricare il prossimo film
    function loadNextMovie() {
        if (movieIndex < movieList.length) {
            currentMovie = movieList[movieIndex];
            movieContainer.innerHTML = `<img src="https://image.tmdb.org/t/p/w200${currentMovie.poster_path}" alt="${currentMovie.title}">
                                         <h3>${currentMovie.title}</h3>`;
            updateCurrentFilmInDB(currentMovie.title);
            movieIndex++;
        } else {
            movieContainer.innerHTML = '<p>Nessun altro film disponibile.</p>';
        }
    }

    // Funzione per aggiornare il film attuale nel DB
    async function updateCurrentFilmInDB(movieTitle) {
        const sessionRef = doc(db, "sessions", sessionCode);
        await updateDoc(sessionRef, {
            currentFilm: movieTitle
        });
    }

    // Funzione per gestire la votazione
    async function handleVote(vote) {
        const sessionRef = doc(db, "sessions", sessionCode);
        await updateDoc(sessionRef, {
            votes: arrayUnion(vote)
        });
    }
});
