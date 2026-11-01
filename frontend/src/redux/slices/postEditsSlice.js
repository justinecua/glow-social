import { createSlice } from "@reduxjs/toolkit";

/** Edits and deletions made this session, keyed by post id. Every post list
 *  (feed, profile, explore, single post) merges these in, so a change shows
 *  everywhere at once without refetching each list. */
const postEditsSlice = createSlice({
  name: "postEdits",
  initialState: {
    edited: {},
    deleted: {},
  },
  reducers: {
    postEdited(state, action) {
      const { id, ...changes } = action.payload;
      state.edited[id] = { ...state.edited[id], ...changes };
    },
    postDeleted(state, action) {
      state.deleted[action.payload] = true;
    },
  },
});

export const { postEdited, postDeleted } = postEditsSlice.actions;
export default postEditsSlice.reducer;
