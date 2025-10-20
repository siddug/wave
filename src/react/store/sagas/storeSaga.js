import { call, put, takeEvery } from 'redux-saga/effects';
import { STORE_ACTIONS, storeActions } from '../slices/storeSlice';

// API calls to electron
const storeAPI = {
  get: (key) => window.electronAPI.store.get(key),
  set: (key, value) => window.electronAPI.store.set(key, value),
  delete: (key) => window.electronAPI.store.delete(key),
  clear: () => window.electronAPI.store.clear(),
  has: (key) => window.electronAPI.store.has(key),
};

// Saga workers
function* getValueSaga(action) {
  try {
    yield put(storeActions.setLoading(true));
    const value = yield call(storeAPI.get, action.payload);
    yield put(storeActions.setValue(action.payload, value));
  } catch (error) {
    yield put(storeActions.setError(error.message));
  }
}

function* setStoreValueSaga(action) {
  try {
    const { key, value } = action.payload;
    yield call(storeAPI.set, key, value);
    // Value will be set via IPC broadcast, no need to update state here
  } catch (error) {
    yield put(storeActions.setError(error.message));
  }
}

function* deleteStoreValueSaga(action) {
  try {
    yield call(storeAPI.delete, action.payload);
    // Value will be deleted via IPC broadcast, no need to update state here
  } catch (error) {
    yield put(storeActions.setError(error.message));
  }
}

function* clearElectronStoreSaga() {
  try {
    yield call(storeAPI.clear);
    // Store will be cleared via IPC broadcast, no need to update state here
  } catch (error) {
    yield put(storeActions.setError(error.message));
  }
}

// Saga watchers
export default function* storeSaga() {
  yield takeEvery(STORE_ACTIONS.GET_VALUE, getValueSaga);
  yield takeEvery(STORE_ACTIONS.SET_STORE_VALUE, setStoreValueSaga);
  yield takeEvery(STORE_ACTIONS.DELETE_STORE_VALUE, deleteStoreValueSaga);
  yield takeEvery(STORE_ACTIONS.CLEAR_ELECTRON_STORE, clearElectronStoreSaga);
}