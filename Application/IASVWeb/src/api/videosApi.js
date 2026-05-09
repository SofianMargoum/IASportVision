import { request } from './client';

// GET /api/videos?folder=<club name>
// Retourne typiquement { videos: [{ name, url, cover, json, date, size }, ...] }
// On normalise pour renvoyer directement un tableau côté UI.
export async function fetchVideosByClub(clubName) {
  if (!clubName) return [];
  const data = await request(`/api/videos?folder=${encodeURIComponent(clubName)}`);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.videos)) return data.videos;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function deleteVideo(clubName, videoName) {
  return request(`/api/videos`, {
    method: 'DELETE',
    body: { folder: clubName, name: videoName },
  });
}
