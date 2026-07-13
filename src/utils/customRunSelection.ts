export type CustomRunSelectionState = {
  selectedTodayCustomRunId: string | null;
  selectedTodayDate: string | null;
  dismissedTodayCustomRunId: string | null;
};

export function selectCustomRunForDate(
  state: CustomRunSelectionState,
  id: string,
  date: string,
): CustomRunSelectionState {
  return {
    ...state,
    selectedTodayCustomRunId: id,
    selectedTodayDate: date,
    dismissedTodayCustomRunId: null,
  };
}

export function dismissCustomRunForDate(
  state: CustomRunSelectionState,
  date: string,
): CustomRunSelectionState {
  if (state.selectedTodayDate !== date || !state.selectedTodayCustomRunId) return state;
  return {
    selectedTodayCustomRunId: null,
    selectedTodayDate: date,
    dismissedTodayCustomRunId: state.selectedTodayCustomRunId,
  };
}

export function restoreCustomRunForDate(
  state: CustomRunSelectionState,
  date: string,
): CustomRunSelectionState {
  if (state.selectedTodayDate !== date || !state.dismissedTodayCustomRunId) return state;
  return {
    selectedTodayCustomRunId: state.dismissedTodayCustomRunId,
    selectedTodayDate: date,
    dismissedTodayCustomRunId: null,
  };
}
