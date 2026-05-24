import api from './api';

// Get the logged-in expert's own availability, timezone, slotDuration
export const getMyAvailability = async () => {
  const response = await api.get('/availability/my');
  return response.data;
};

// Update the logged-in expert's availability
export const updateMyAvailability = async (payload) => {
  const response = await api.put('/availability/my', payload);
  return response.data;
};
