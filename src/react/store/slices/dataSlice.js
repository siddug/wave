// Data slice for managing application data with pagination
const initialState = {
  items: [],
  loading: false,
  error: null,
  pagination: {
    total: 0,
    hasMore: false,
    offset: 0,
    limit: 50
  },
  filters: {
    startTime: null,
    endTime: null
  }
};

// Action types
export const DATA_ACTIONS = {
  // Sync actions
  SET_LOADING: 'data/setLoading',
  SET_ERROR: 'data/setError',
  SET_ITEMS: 'data/setItems',
  ADD_ITEMS: 'data/addItems',
  UPDATE_ITEM: 'data/updateItem',
  REMOVE_ITEM: 'data/removeItem',
  SET_PAGINATION: 'data/setPagination',
  SET_FILTERS: 'data/setFilters',
  CLEAR_DATA: 'data/clearData',
  
  // Async actions (handled by sagas)
  FETCH_DATA: 'data/fetchData',
  ADD_DATA: 'data/addData',
  UPDATE_DATA: 'data/updateData',
  DELETE_DATA: 'data/deleteData',
  CLEANUP_DATA: 'data/cleanupData',
  
  // IPC sync actions
  IPC_DATA_ADDED: 'data/ipcDataAdded',
  IPC_DATA_UPDATED: 'data/ipcDataUpdated',
  IPC_DATA_DELETED: 'data/ipcDataDeleted',
  IPC_CLEANUP_COMPLETED: 'data/ipcCleanupCompleted',
};

// Action creators
export const dataActions = {
  setLoading: (loading) => ({ type: DATA_ACTIONS.SET_LOADING, payload: loading }),
  setError: (error) => ({ type: DATA_ACTIONS.SET_ERROR, payload: error }),
  setItems: (items) => ({ type: DATA_ACTIONS.SET_ITEMS, payload: items }),
  addItems: (items) => ({ type: DATA_ACTIONS.ADD_ITEMS, payload: items }),
  updateItem: (item) => ({ type: DATA_ACTIONS.UPDATE_ITEM, payload: item }),
  removeItem: (id) => ({ type: DATA_ACTIONS.REMOVE_ITEM, payload: id }),
  setPagination: (pagination) => ({ type: DATA_ACTIONS.SET_PAGINATION, payload: pagination }),
  setFilters: (filters) => ({ type: DATA_ACTIONS.SET_FILTERS, payload: filters }),
  clearData: () => ({ type: DATA_ACTIONS.CLEAR_DATA }),
  
  fetchData: (options = {}) => ({ type: DATA_ACTIONS.FETCH_DATA, payload: options }),
  addData: (item) => ({ type: DATA_ACTIONS.ADD_DATA, payload: item }),
  updateData: (id, updates) => ({ type: DATA_ACTIONS.UPDATE_DATA, payload: { id, updates } }),
  deleteData: (id) => ({ type: DATA_ACTIONS.DELETE_DATA, payload: id }),
  cleanupData: (olderThan) => ({ type: DATA_ACTIONS.CLEANUP_DATA, payload: olderThan }),
  
  ipcDataAdded: (item) => ({ type: DATA_ACTIONS.IPC_DATA_ADDED, payload: item }),
  ipcDataUpdated: (item) => ({ type: DATA_ACTIONS.IPC_DATA_UPDATED, payload: item }),
  ipcDataDeleted: (id) => ({ type: DATA_ACTIONS.IPC_DATA_DELETED, payload: id }),
  ipcCleanupCompleted: (data) => ({ type: DATA_ACTIONS.IPC_CLEANUP_COMPLETED, payload: data }),
};

// Reducer
const dataReducer = (state = initialState, action) => {
  switch (action.type) {
    case DATA_ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
      
    case DATA_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
      
    case DATA_ACTIONS.SET_ITEMS:
      return { ...state, items: action.payload, loading: false, error: null };
      
    case DATA_ACTIONS.ADD_ITEMS:
      return { 
        ...state, 
        items: [...state.items, ...action.payload],
        loading: false, 
        error: null 
      };
      
    case DATA_ACTIONS.UPDATE_ITEM:
      return {
        ...state,
        items: state.items.map(item => 
          item.id === action.payload.id ? action.payload : item
        )
      };
      
    case DATA_ACTIONS.REMOVE_ITEM:
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };
      
    case DATA_ACTIONS.SET_PAGINATION:
      return {
        ...state,
        pagination: { ...state.pagination, ...action.payload }
      };
      
    case DATA_ACTIONS.SET_FILTERS:
      return {
        ...state,
        filters: { ...state.filters, ...action.payload }
      };
      
    case DATA_ACTIONS.CLEAR_DATA:
      return { ...initialState };
      
    case DATA_ACTIONS.IPC_DATA_ADDED:
      // Only add if not already present
      if (!state.items.find(item => item.id === action.payload.id)) {
        return {
          ...state,
          items: [action.payload, ...state.items]
        };
      }
      return state;
      
    case DATA_ACTIONS.IPC_DATA_UPDATED:
      return {
        ...state,
        items: state.items.map(item => 
          item.id === action.payload.id ? action.payload : item
        )
      };
      
    case DATA_ACTIONS.IPC_DATA_DELETED:
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };
      
    default:
      return state;
  }
};

export default dataReducer;