import { call, put, takeEvery, select, takeLatest } from 'redux-saga/effects';
import { DATA_ACTIONS, dataActions } from '../slices/dataSlice';

// API calls to electron
const dataAPI = {
  query: (options) => window.electronAPI.data.query(options),
  add: (item) => window.electronAPI.data.add(item),
  update: (id, updates) => window.electronAPI.data.update(id, updates),
  delete: (id) => window.electronAPI.data.delete(id),
  cleanup: (olderThan) => window.electronAPI.data.cleanup(olderThan),
};

// Selectors
const getDataFilters = (state) => state.data.filters;
const getDataPagination = (state) => state.data.pagination;

// Saga workers
function* fetchDataSaga(action) {
  try {
    yield put(dataActions.setLoading(true));
    
    const filters = yield select(getDataFilters);
    const pagination = yield select(getDataPagination);
    
    const options = {
      ...filters,
      ...pagination,
      ...action.payload
    };
    
    const response = yield call(dataAPI.query, options);
    
    if (action.payload.append) {
      yield put(dataActions.addItems(response.data));
    } else {
      yield put(dataActions.setItems(response.data));
    }
    
    yield put(dataActions.setPagination({
      total: response.total,
      hasMore: response.hasMore,
      offset: options.offset || 0
    }));
    
  } catch (error) {
    yield put(dataActions.setError(error.message));
  }
}

function* addDataSaga(action) {
  try {
    const response = yield call(dataAPI.add, action.payload);
    // Item will be added via IPC broadcast, no need to update state here
  } catch (error) {
    yield put(dataActions.setError(error.message));
  }
}

function* updateDataSaga(action) {
  try {
    const { id, updates } = action.payload;
    const response = yield call(dataAPI.update, id, updates);
    // Item will be updated via IPC broadcast, no need to update state here
  } catch (error) {
    yield put(dataActions.setError(error.message));
  }
}

function* deleteDataSaga(action) {
  try {
    const response = yield call(dataAPI.delete, action.payload);
    // Item will be removed via IPC broadcast, no need to update state here
  } catch (error) {
    yield put(dataActions.setError(error.message));
  }
}

function* cleanupDataSaga(action) {
  try {
    const response = yield call(dataAPI.cleanup, action.payload);
    // Cleanup completion will be handled via IPC broadcast
  } catch (error) {
    yield put(dataActions.setError(error.message));
  }
}

// Saga watchers
export default function* dataSaga() {
  yield takeLatest(DATA_ACTIONS.FETCH_DATA, fetchDataSaga);
  yield takeEvery(DATA_ACTIONS.ADD_DATA, addDataSaga);
  yield takeEvery(DATA_ACTIONS.UPDATE_DATA, updateDataSaga);
  yield takeEvery(DATA_ACTIONS.DELETE_DATA, deleteDataSaga);
  yield takeEvery(DATA_ACTIONS.CLEANUP_DATA, cleanupDataSaga);
}