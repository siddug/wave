import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { storeActions } from '../store/slices/storeSlice';
import { getStoreValue, getStoreLoading, getStoreError } from '../store/selectors/storeSelectors';

// Hook to interact with electron store
export const useElectronStore = (key, defaultValue) => {
  const dispatch = useDispatch();
  const value = useSelector(getStoreValue(key));
  const loading = useSelector(getStoreLoading);
  const error = useSelector(getStoreError);

  // Load initial value
  useEffect(() => {
    if (value === undefined && key) {
      dispatch(storeActions.getValue(key));
    }
  }, [dispatch, key, value]);

  const setValue = (newValue) => {
    dispatch(storeActions.setStoreValue(key, newValue));
  };

  const deleteValue = () => {
    dispatch(storeActions.deleteStoreValue(key));
  };

  return {
    value: value !== undefined ? value : defaultValue,
    setValue,
    deleteValue,
    loading,
    error
  };
};

// Hook to clear the entire store
export const useElectronStoreClear = () => {
  const dispatch = useDispatch();

  const clearStore = () => {
    dispatch(storeActions.clearElectronStore());
  };

  return { clearStore };
};