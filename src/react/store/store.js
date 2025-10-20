import { createStore, applyMiddleware, combineReducers } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { composeWithDevTools } from '@redux-devtools/extension';
import dataReducer from './slices/dataSlice';
import storeReducer from './slices/storeSlice';
import rootSaga from './sagas/rootSaga';

const rootReducer = combineReducers({
  data: dataReducer,
  store: storeReducer,
});

const sagaMiddleware = createSagaMiddleware();

export const store = createStore(
  rootReducer,
  composeWithDevTools(applyMiddleware(sagaMiddleware))
);

sagaMiddleware.run(rootSaga);