import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "../services/auth/auth";
import { api } from "../services/auth/token";
import authReducer from "../slices/authSlice";
import uiReducer, { saveSidebars } from "../slices/uiSlice";
import postEditsReducer from "../slices/postEditsSlice";

export const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [api.reducerPath]: api.reducer,
    auth: authReducer,
    ui: uiReducer,
    postEdits: postEditsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(authApi.middleware).concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Remember sidebar collapse choices on this device.
let lastUi = store.getState().ui;
store.subscribe(() => {
  const ui = store.getState().ui;
  if (ui !== lastUi) {
    lastUi = ui;
    saveSidebars(ui);
  }
});
