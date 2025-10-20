import { all, fork } from 'redux-saga/effects';
import dataSaga from './dataSaga';
import storeSaga from './storeSaga';
import ipcSaga from './ipcSaga';

export default function* rootSaga() {
  yield all([
    fork(dataSaga),
    fork(storeSaga),
    fork(ipcSaga)
  ]);
}