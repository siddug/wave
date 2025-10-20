// Store slice for managing electron-store data
const initialState = {
  values: {},
  loading: false,
  error: null
};

// Action types
export const STORE_ACTIONS = {
  // Sync actions
  SET_LOADING: 'store/setLoading',
  SET_ERROR: 'store/setError',
  SET_VALUE: 'store/setValue',
  DELETE_VALUE: 'store/deleteValue',
  CLEAR_STORE: 'store/clearStore',
  
  // Async actions (handled by sagas)
  GET_VALUE: 'store/getValue',
  SET_STORE_VALUE: 'store/setStoreValue',
  DELETE_STORE_VALUE: 'store/deleteStoreValue',
  CLEAR_ELECTRON_STORE: 'store/clearElectronStore',
  
  // IPC sync actions
  IPC_STORE_CHANGED: 'store/ipcStoreChanged',
  IPC_STORE_DELETED: 'store/ipcStoreDeleted',
  IPC_STORE_CLEARED: 'store/ipcStoreCleared',
};

// Action creators
export const storeActions = {
  setLoading: (loading) => ({ type: STORE_ACTIONS.SET_LOADING, payload: loading }),
  setError: (error) => ({ type: STORE_ACTIONS.SET_ERROR, payload: error }),
  setValue: (key, value) => ({ type: STORE_ACTIONS.SET_VALUE, payload: { key, value } }),
  deleteValue: (key) => ({ type: STORE_ACTIONS.DELETE_VALUE, payload: key }),
  clearStore: () => ({ type: STORE_ACTIONS.CLEAR_STORE }),
  
  getValue: (key) => ({ type: STORE_ACTIONS.GET_VALUE, payload: key }),
  setStoreValue: (key, value) => ({ type: STORE_ACTIONS.SET_STORE_VALUE, payload: { key, value } }),
  deleteStoreValue: (key) => ({ type: STORE_ACTIONS.DELETE_STORE_VALUE, payload: key }),
  clearElectronStore: () => ({ type: STORE_ACTIONS.CLEAR_ELECTRON_STORE }),
  
  ipcStoreChanged: (key, value) => ({ type: STORE_ACTIONS.IPC_STORE_CHANGED, payload: { key, value } }),
  ipcStoreDeleted: (key) => ({ type: STORE_ACTIONS.IPC_STORE_DELETED, payload: key }),
  ipcStoreCleared: () => ({ type: STORE_ACTIONS.IPC_STORE_CLEARED }),
};

// Reducer
const storeReducer = (state = initialState, action) => {
  switch (action.type) {
    case STORE_ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
      
    case STORE_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
      
    case STORE_ACTIONS.SET_VALUE:
      return {
        ...state,
        values: { ...state.values, [action.payload.key]: action.payload.value },
        loading: false,
        error: null
      };
      
    case STORE_ACTIONS.DELETE_VALUE:
      const newValues = { ...state.values };
      delete newValues[action.payload];
      return { ...state, values: newValues };
      
    case STORE_ACTIONS.CLEAR_STORE:
      return { ...initialState };
      
    case STORE_ACTIONS.IPC_STORE_CHANGED:
      return {
        ...state,
        values: { ...state.values, [action.payload.key]: action.payload.value }
      };
      
    case STORE_ACTIONS.IPC_STORE_DELETED:
      const updatedValues = { ...state.values };
      delete updatedValues[action.payload];
      return { ...state, values: updatedValues };
      
    case STORE_ACTIONS.IPC_STORE_CLEARED:
      return { ...state, values: {} };
      
    default:
      return state;
  }
};

export default storeReducer;