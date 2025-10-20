import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { dataActions } from '../store/slices/dataSlice';
import {
  getDataItems,
  getDataLoading,
  getDataError,
  getDataPagination,
  getDataFilters
} from '../store/selectors/dataSelectors';

// Hook to interact with electron data
export const useElectronData = () => {
  const dispatch = useDispatch();
  const items = useSelector(getDataItems);
  const loading = useSelector(getDataLoading);
  const error = useSelector(getDataError);
  const pagination = useSelector(getDataPagination);
  const filters = useSelector(getDataFilters);

  // Fetch data
  const fetchData = useCallback((options = {}) => {
    dispatch(dataActions.fetchData(options));
  }, [dispatch]);

  // Fetch more data (for pagination)
  const fetchMoreData = useCallback(() => {
    if (pagination.hasMore && !loading) {
      fetchData({
        offset: items.length,
        append: true
      });
    }
  }, [fetchData, pagination.hasMore, loading, items.length]);

  // Add new data
  const addData = useCallback((item) => {
    dispatch(dataActions.addData(item));
  }, [dispatch]);

  // Update existing data
  const updateData = useCallback((id, updates) => {
    dispatch(dataActions.updateData(id, updates));
  }, [dispatch]);

  // Delete data
  const deleteData = useCallback((id) => {
    dispatch(dataActions.deleteData(id));
  }, [dispatch]);

  // Cleanup old data
  const cleanupData = useCallback((olderThan) => {
    dispatch(dataActions.cleanupData(olderThan));
  }, [dispatch]);

  // Set filters
  const setFilters = useCallback((newFilters) => {
    dispatch(dataActions.setFilters(newFilters));
  }, [dispatch]);

  // Clear all data
  const clearData = useCallback(() => {
    dispatch(dataActions.clearData());
  }, [dispatch]);

  // Refresh data (re-fetch with current filters)
  const refreshData = useCallback(() => {
    fetchData({ offset: 0 });
  }, [fetchData]);

  return {
    items,
    loading,
    error,
    pagination,
    filters,
    fetchData,
    fetchMoreData,
    addData,
    updateData,
    deleteData,
    cleanupData,
    setFilters,
    clearData,
    refreshData,
    canLoadMore: pagination.hasMore && !loading
  };
};

// Hook to get data for a specific time range
export const useElectronDataByTimeRange = (startTime, endTime) => {
  const {
    items,
    loading,
    error,
    fetchData,
    setFilters,
    ...rest
  } = useElectronData();

  useEffect(() => {
    setFilters({ startTime, endTime });
  }, [setFilters, startTime, endTime]);

  useEffect(() => {
    fetchData({ offset: 0 });
  }, [fetchData, startTime, endTime]);

  return {
    items,
    loading,
    error,
    ...rest
  };
};