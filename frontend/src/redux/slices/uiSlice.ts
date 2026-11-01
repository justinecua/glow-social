import { createSlice } from "@reduxjs/toolkit";

const KEY = "glow_sidebars";

const load = (): { leftCollapsed: boolean; rightCollapsed: boolean } => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { leftCollapsed: !!v.leftCollapsed, rightCollapsed: !!v.rightCollapsed };
  } catch {
    return { leftCollapsed: false, rightCollapsed: false };
  }
};

/** Desktop sidebars: full width, or collapsed to an icon rail. */
const uiSlice = createSlice({
  name: "ui",
  initialState: load(),
  reducers: {
    toggleLeftSidebar(state) {
      state.leftCollapsed = !state.leftCollapsed;
    },
    toggleRightSidebar(state) {
      state.rightCollapsed = !state.rightCollapsed;
    },
  },
});

export const saveSidebars = (state: { leftCollapsed: boolean; rightCollapsed: boolean }) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: still works for this visit */
  }
};

export const { toggleLeftSidebar, toggleRightSidebar } = uiSlice.actions;
export default uiSlice.reducer;
