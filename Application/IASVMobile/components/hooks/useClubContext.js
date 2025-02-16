import { useContext } from 'react';
import { ClubContext } from '../ClubContext'; // Suppose que ClubProvider existe

export const useClubContext = () => {
  return useContext(ClubContext);
};
