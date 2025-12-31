import { configureStore } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

// Create a slice for drag and drop state
const dragDropSlice = createSlice({
  name: 'dragDrop',
  initialState: {
    // Add any drag and drop related state here if needed
  },
  reducers: {
    // Add any drag and drop related reducers here if needed
  }
});

// Create the store
export const store = configureStore({
  reducer: {
    dragDrop: dragDropSlice.reducer,
    // Add other reducers here as needed
  },
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 