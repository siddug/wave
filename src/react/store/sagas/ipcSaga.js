import { eventChannel, END } from 'redux-saga';
import { call, put, take, fork } from 'redux-saga/effects';
import { dataActions } from '../slices/dataSlice';
import { storeActions } from '../slices/storeSlice';

// Create event channels for IPC listeners
function createDataEventChannel() {
  return eventChannel(emit => {
    const unsubscribeAdded = window.electronAPI.data.onAdded((item) => {
      emit({ type: 'DATA_ADDED', payload: item });
    });
    
    const unsubscribeUpdated = window.electronAPI.data.onUpdated((item) => {
      emit({ type: 'DATA_UPDATED', payload: item });
    });
    
    const unsubscribeDeleted = window.electronAPI.data.onDeleted((id) => {
      emit({ type: 'DATA_DELETED', payload: id });
    });
    
    const unsubscribeCleanup = window.electronAPI.data.onCleanupCompleted((data) => {
      emit({ type: 'CLEANUP_COMPLETED', payload: data });
    });
    
    // Return unsubscribe function
    return () => {
      unsubscribeAdded();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeCleanup();
    };
  });
}

function createStoreEventChannel() {
  return eventChannel(emit => {
    const unsubscribeChanged = window.electronAPI.store.onChanged(({ key, value }) => {
      emit({ type: 'STORE_CHANGED', payload: { key, value } });
    });
    
    const unsubscribeDeleted = window.electronAPI.store.onDeleted(({ key }) => {
      emit({ type: 'STORE_DELETED', payload: key });
    });
    
    const unsubscribeCleared = window.electronAPI.store.onCleared(() => {
      emit({ type: 'STORE_CLEARED' });
    });
    
    // Return unsubscribe function
    return () => {
      unsubscribeChanged();
      unsubscribeDeleted();
      unsubscribeCleared();
    };
  });
}

// Saga to handle data events
function* watchDataEvents() {
  const dataChannel = yield call(createDataEventChannel);
  
  try {
    while (true) {
      const action = yield take(dataChannel);
      
      switch (action.type) {
        case 'DATA_ADDED':
          yield put(dataActions.ipcDataAdded(action.payload));
          break;
        case 'DATA_UPDATED':
          yield put(dataActions.ipcDataUpdated(action.payload));
          break;
        case 'DATA_DELETED':
          yield put(dataActions.ipcDataDeleted(action.payload));
          break;
        case 'CLEANUP_COMPLETED':
          yield put(dataActions.ipcCleanupCompleted(action.payload));
          break;
        default:
          break;
      }
    }
  } finally {
    dataChannel.close();
  }
}

// Saga to handle store events
function* watchStoreEvents() {
  const storeChannel = yield call(createStoreEventChannel);
  
  try {
    while (true) {
      const action = yield take(storeChannel);
      
      switch (action.type) {
        case 'STORE_CHANGED':
          yield put(storeActions.ipcStoreChanged(action.payload.key, action.payload.value));
          break;
        case 'STORE_DELETED':
          yield put(storeActions.ipcStoreDeleted(action.payload));
          break;
        case 'STORE_CLEARED':
          yield put(storeActions.ipcStoreCleared());
          break;
        default:
          break;
      }
    }
  } finally {
    storeChannel.close();
  }
}

// Root IPC saga
export default function* ipcSaga() {
  yield fork(watchDataEvents);
  yield fork(watchStoreEvents);
}