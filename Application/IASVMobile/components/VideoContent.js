import { useState, useEffect, useContext } from 'react';
import { searchClubs, startRecording, stopRecording, getPlaybackURI, uploadVideo, mergeImages } from './api';
import { useClubContext } from './ClubContext';
import { UserContext } from './UserContext';

export const useVideoContent = () => {
  const { selectedClub, setSelectedClub } = useClubContext();
  const { user } = useContext(UserContext);

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

  const params = {
    username: 'admin',
    password: 'Vidauban',
    ipAddress: '2a01:cb1c:fc0:9f00:3e1b:f8ff:fefa:557b',
    port: 1000,
  };

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setTimeElapsed((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(timer);
    }

    return () => clearInterval(timer);
  }, [isRecording]);

  const handleInputChange = (text) => {
    setFilename(text);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(async () => {
      const results = await searchClubs(text);
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
        await stopRecording(params);

        const playbackData = await getPlaybackURI(params);
        const { playbackURI, videoDuration } = playbackData;
        setPlaybackURI(playbackURI);
        setVideoDuration(videoDuration);

        const directory = selectedClub ? selectedClub.name : 'Unknown Club';
        const combinedFilename = selectedClubInfo
          ? `${counter} - ${secondCounter} ${selectedClubInfo.name}`
          : `${counter} - ${secondCounter} Unknown Club`;

        await uploadVideo(combinedFilename, playbackURI, directory, videoDuration);

        const mergeParams = {
          logo1Url: selectedClub?.logo || 'https://storage.googleapis.com/ia-sport.appspot.com/images/logo_default.png',
          logo2Url: selectedClubInfo?.logo || 'https://storage.googleapis.com/ia-sport.appspot.com/images/logo_default.png',
          finalFolder: directory,
          finalName: directory + ` ${combinedFilename}.png`,
        };

        try {
          const mergeResponse = await mergeImages(mergeParams);
          setMessage(`Recording stopped, video uploaded, and image merged successfully: ${mergeResponse.url}`);
        } catch (error) {
          setMessage('Recording stopped, video uploaded, but image merging failed');
        }
      } catch (error) {
        setMessage('Failed to stop recording or upload video');
      }
    } else {
      try {
        await startRecording(params);
        setIsRecording(true);
        setTimeElapsed(0);
        setMessage('Recording started successfully');
      } catch (error) {
        setMessage('Failed to start recording');
      }
    }
  };

  const clearSelectedClub = () => {
    setSelectedClubInfo(null);
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const incrementCounter = () => {
    setCounter((prevCounter) => prevCounter + 1);
  };

  const decrementCounter = () => {
    setCounter((prevCounter) => Math.max(prevCounter - 1, 0));
  };

  const incrementSecondCounter = () => {
    setSecondCounter((prevCounter) => prevCounter + 1);
  };

  const decrementSecondCounter = () => {
    setSecondCounter((prevCounter) => Math.max(prevCounter - 1, 0));
  };

  return {
    user,
    selectedClub,
    selectedClubInfo,
    filename,
    searchResults,
    isRecording,
    timeElapsed,
    message,
    counter,
    secondCounter,
    handleInputChange,
    handleResultClick,
    handleButtonClick,
    clearSelectedClub,
    formatTime,
    incrementCounter,
    decrementCounter,
    incrementSecondCounter,
    decrementSecondCounter,
  };
};
