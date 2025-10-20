import { createSelector } from 'reselect';

// Base selectors
export const getStoreState = (state) => state.store;

// Derived selectors
export const getStoreValues = createSelector(
  [getStoreState],
  (storeState) => storeState.values
);

export const getStoreLoading = createSelector(
  [getStoreState],
  (storeState) => storeState.loading
);

export const getStoreError = createSelector(
  [getStoreState],
  (storeState) => storeState.error
);

// Value selectors
export const getStoreValue = (key) => createSelector(
  [getStoreValues],
  (values) => values[key]
);

export const getStoreValueWithDefault = (key, defaultValue) => createSelector(
  [getStoreValues],
  (values) => values[key] !== undefined ? values[key] : defaultValue
);