import { createSelector } from 'reselect';

// Base selectors
export const getDataState = (state) => state.data;

// Derived selectors
export const getDataItems = createSelector(
  [getDataState],
  (dataState) => dataState.items
);

export const getDataLoading = createSelector(
  [getDataState],
  (dataState) => dataState.loading
);

export const getDataError = createSelector(
  [getDataState],
  (dataState) => dataState.error
);

export const getDataPagination = createSelector(
  [getDataState],
  (dataState) => dataState.pagination
);

export const getDataFilters = createSelector(
  [getDataState],
  (dataState) => dataState.filters
);

// Complex selectors
export const getFilteredDataItems = createSelector(
  [getDataItems, getDataFilters],
  (items, filters) => {
    return items.filter(item => {
      if (filters.startTime && item.timestamp < filters.startTime) return false;
      if (filters.endTime && item.timestamp > filters.endTime) return false;
      return true;
    });
  }
);

export const getDataItemById = (id) => createSelector(
  [getDataItems],
  (items) => items.find(item => item.id === id)
);

export const getDataStats = createSelector(
  [getDataItems],
  (items) => ({
    totalItems: items.length,
    oldestTimestamp: items.length > 0 ? Math.min(...items.map(item => item.timestamp || 0)) : null,
    newestTimestamp: items.length > 0 ? Math.max(...items.map(item => item.timestamp || 0)) : null,
  })
);