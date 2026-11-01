import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Edits and deletions made this session, keyed by post id. Every post list
 *  (feed, profile, explore, single post) merges these in, so a change shows
 *  everywhere at once without refetching each list. */
type PostEdit = { caption?: string; audience?: string };

const postEditsSlice = createSlice({
  name: "postEdits",
  initialState: {
    edited: {} as Record<number, PostEdit>,
    deleted: {} as Record<number, true>,
  },
  reducers: {
    postEdited(state, action: PayloadAction<{ id: number } & PostEdit>) {
      const { id, ...changes } = action.payload;
      state.edited[id] = { ...state.edited[id], ...changes };
    },
    postDeleted(state, action: PayloadAction<number>) {
      state.deleted[action.payload] = true;
    },
  },
});

export const { postEdited, postDeleted } = postEditsSlice.actions;
export default postEditsSlice.reducer;
