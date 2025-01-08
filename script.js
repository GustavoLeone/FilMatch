import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyDj9mfcLOxKIpTFrsSwA-Al1xtT8rAQuIU",
    authDomain: "gu-filmatch.firebaseapp.com",
    projectId: "gu-filmatch",
    storageBucket: "gu-filmatch.firebasestorage.app",
    messagingSenderId: "102030937017",
    appId: "1:102030937017:web:1dc8161573d755c8bfc468",
    measurementId: "G-Z4GP6SXJ88"
  };
  
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);

document.addEventListener('DOMContentLoaded', function() {
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
  
    // Gestione pulsanti iniziali
    startSessionBtn.addEventListener('click', () => {
      // Genera un codice univoco per la sessione
      sessionCode = generateSessionCode();
      sessionCodeDisplay.textContent = sessionCode;
      sessionContainer.classList.remove('hidden');
      joinSessionForm.classList.add('hidden');
      loadNextMovie();
    });
  
    joinSessionBtn.addEventListener('click', () => {
      // Mostra il form per partecipare a una sessione
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
      if (validateSessionCode(code)) {
        sessionCode = code;
        sessionCodeDisplay.textContent = sessionCode;
        sessionContainer.classList.remove('hidden');
        joinSessionForm.classList.add('hidden');
        loadNextMovie();
      } else {
        alert('Sessione non esistente');
      }
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
    });
  
    // Funzione per generare il codice sessione
    function generateSessionCode() {
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
  
    // Funzione per validare il codice della sessione
    function validateSessionCode(code) {
      // Logica per validare il codice (per esempio, simulare un controllo in un database o su Firebase)
      // Qui simulerò un esempio con codici fittizi
      const validCodes = ['ABCD1234', 'EFGH5678', 'IJKL91011']; // Codici sessione validi
      return validCodes.includes(code);
    }
  
    // Funzione per caricare il prossimo film
    function loadNextMovie() {
      // In una versione futura, potresti prendere i film da un'API come TMDB
      currentMovie = {
        title: 'Inception',
        poster: 'https://image.tmdb.org/t/p/w200/qmDpIHrmpJINaRKAfWQfftjCdyi.jpg',
      };
      movieContainer.innerHTML = `<img src="${currentMovie.poster}" alt="${currentMovie.title}">
                                   <h3>${currentMovie.title}</h3>`;
    }
  
    // Funzione per gestire la votazione
    function handleVote(vote) {
      if (vote === 'like') {
        // Logica per il "Mi piace"
        console.log('Film piaciuto');
      } else {
        // Logica per il "Non mi piace"
        console.log('Film non piaciuto');
      }
  
      loadNextMovie(); // Carica il prossimo film
    }
  });
  