import { searchClubs, startRecording, stopRecording, getPlaybackURI, uploadVideo, mergeImages } from '../components/api';

export const performClubSearch = async (query) => {
  try {
    return await searchClubs(query);
  } catch (error) {
    console.error('Error searching clubs:', error);
    return [];
  }
};

export const handleRecordingStart = async (params) => {
  try {
    await startRecording(params);
    return 'Recording started successfully';
  } catch (error) {
    console.error('Error starting recording:', error);
    throw new Error('Failed to start recording');
  }
};

export const handleRecordingStop = async (params) => {
  try {
    await stopRecording(params);
    return await getPlaybackURI(params);
  } catch (error) {
    console.error('Error stopping recording:', error);
    throw new Error('Failed to stop recording');
  }
};

export const uploadAndMergeVideo = async (filename, playbackURI, directory, videoDuration, selectedClub, selectedClubInfo) => {
  const mergeParams = {
    logo1Url: selectedClub?.logo || 'https://storage.googleapis.com/ia-sport.appspot.com/images/logo_default.png',
    logo2Url: selectedClubInfo?.logo || 'https://storage.googleapis.com/ia-sport.appspot.com/images/logo_default.png',
    finalFolder: directory,
    finalName: `${directory}/${filename}.png`,
  };

  try {
    await uploadVideo(filename, playbackURI, directory, videoDuration);
    const mergeResponse = await mergeImages(mergeParams);
    return { success: true, url: mergeResponse.url };
  } catch (error) {
    console.error('Error uploading or merging video:', error);
    return { success: false };
  }
};
