import React, { useState, useEffect } from 'react';
import { FaPlay, FaStop, FaPlus, FaMinus, FaExchangeAlt, FaRecordVinyl } from 'react-icons/fa';
import './css/Home.css';
import { searchClubs, startRecording, stopRecording, getPlaybackURI, uploadVideo } from './api';
import config from '../config'; // Importer config pour récupérer le club sélectionné

function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [playbackURI, setPlaybackURI] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [filename, setFilename] = useState('');
  const [message, setMessage] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [timeoutId, setTimeoutId] = useState(null);
  const [selectedClubInfo, setSelectedClubInfo] = useState(null);
  const [counter, setCounter] = useState(0);
  const [secondCounter, setSecondCounter] = useState(0);

  const selectedClub = config.getSelectedClub(); // Récupérer le club sélectionné depuis config

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setTimeElapsed(prevTime => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(timer);
    }

    return () => clearInterval(timer);
  }, [isRecording]);

  const handleInputChange = (e) => {
    setFilename(e.target.value);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(async () => {
      const results = await searchClubs(e.target.value);
      setSearchResults(results);
    }, 1000);

    setTimeoutId(newTimeoutId);
  };

  const handleResultClick = (result) => {
    setFilename(result.name);
    setSelectedClubInfo(result);
    setSearchResults([]);
  };

  const handleButtonClick = async () => {
    if (isRecording) {
      setFilename('');
      setSelectedClubInfo(null);

      try {
        setIsRecording(false);
        
        await stopRecording();

        const playbackData = await getPlaybackURI();
        const { playbackURI, videoDuration } = playbackData;
        setPlaybackURI(playbackURI);
        setVideoDuration(videoDuration);

        const directory = selectedClub ? selectedClub.name : 'Unknown Club';
        const combinedFilename = selectedClubInfo ? ` ${counter} - ${secondCounter} ${selectedClubInfo.name}` : ` ${counter} - ${secondCounter} Unknown Club`;

        await uploadVideo(combinedFilename, playbackURI, directory, videoDuration);

        setMessage('Enregistrement arrêté et vidéo téléchargée avec succès');
      } catch (error) {
        console.error('Erreur :', error);
        setMessage('Échec de l\'arrêt de l\'enregistrement ou du téléchargement de la vidéo');
      }
    } else {
      try {
        await startRecording();
        setIsRecording(true);
        setTimeElapsed(0);
        setMessage('Enregistrement démarré avec succès');
      } catch (error) {
        console.error('Erreur :', error);
        setMessage('Échec du démarrage de l\'enregistrement');
      }
    }
  };

  const handleSearchResultClick = (index) => {
    const result = searchResults[index];
    if (result) {
      setFilename(result.name);
      setSelectedClubInfo(result);
      setSearchResults([]);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const incrementCounter = () => {
    setCounter(prevCounter => prevCounter + 1);
  };

  const decrementCounter = () => {
    setCounter(prevCounter => Math.max(prevCounter - 1, 0));
  };

  const incrementSecondCounter = () => {
    setSecondCounter(prevCounter => prevCounter + 1);
  };

  const decrementSecondCounter = () => {
    setSecondCounter(prevCounter => Math.max(prevCounter - 1, 0));
  };

  const swapCounters = () => {
    setCounter(prevCounter => {
      setSecondCounter(prevSecondCounter => prevCounter);
      return secondCounter;
    });
  };

  return (
    <div className="home-container">
      <h2>{isRecording ? 'Enregistrement en cours' : 'Démarrer un enregistrement'}</h2>

      <div className="home-main">
        <div className="main-section">
          <div className="top-section">
            {selectedClub && (
              <div className="selected-club-info">
                <img src={selectedClub.logo} alt={selectedClub.name} className="selected-club-logo" />
                <span className="selected-club-name">{selectedClub.name}</span>
              </div>
            )}
            <div className="counter-container">
              <button onClick={incrementCounter}>
                <FaPlus />
              </button>
              <span className="counter-label">{counter}</span>
              <button onClick={decrementCounter} disabled={counter === 0}>
                <FaMinus />
              </button>
            </div>
          </div>
        </div>
	  
        <div className="swap-container">
          <button onClick={swapCounters} className="swap-button">
            <FaExchangeAlt />
          </button>
        </div>
        <div className="main-section">
          <div className="top-section">
            <div className="input-container">
              <div className="input-section">
                {selectedClubInfo ? (
                  <div className="selected-club-info">
                    <img src={selectedClubInfo.logo} alt="Selected club logo" className="selected-club-logo" />
                    <span className="selected-club-name">{selectedClubInfo.name}</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    id="filename"
                    value={filename}
                    onChange={handleInputChange}
                    placeholder="Rechercher le club adverse"
                  />
                )}
              </div>

              {searchResults.length > 0 && (
                <ul className="search-results">
                  {searchResults.slice(0, 3).map((result, index) => (
                    <li key={index} onClick={() => handleSearchResultClick(index)}>
                      <img src={result.logo} alt={result.name} className="result-logo" />
                      <span className="result-name">{result.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="counter-container">
              <button onClick={incrementSecondCounter}>
                <FaPlus />
              </button>
              <span className="counter-label">{secondCounter}</span>
              <button onClick={decrementSecondCounter} disabled={secondCounter === 0}>
                <FaMinus />
              </button>
            </div>
          </div>
        </div>
        {isRecording && (
          <div className="timer">
            <p>Temps d'enregistrement : {formatTime(timeElapsed)}</p>
          </div>
        )}
        {message && (
          <div className="message">
            <p>{message}</p>
          </div>
        )}
        <button
          className={`button ${isRecording ? 'stop' : ''} ${!filename ? 'disabled' : ''}`}
          onClick={handleButtonClick}
          disabled={!filename && !isRecording}
        >
          {isRecording ? <FaStop /> : <FaRecordVinyl />}
        </button>
      </div>
    </div>
  );
}

export default Home;
