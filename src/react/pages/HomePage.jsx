import React, { useEffect } from 'react';
import { useElectronData } from '../hooks/useElectronData';
import { useElectronStore } from '../hooks/useElectronStore';

const HomePage = () => {
  const { items, loading, error, fetchData, addData } = useElectronData();
  const { value: welcomeMessage, setValue: setWelcomeMessage } = useElectronStore('welcomeMessage', 'Welcome to Wave!');

  useEffect(() => {
    fetchData({ limit: 10 });
  }, [fetchData]);

  const handleAddSampleData = () => {
    addData({
      type: 'note',
      title: 'Sample Note',
      content: 'This is a sample note created from the home page.',
      tags: ['sample', 'home']
    });
  };

  const handleUpdateWelcome = () => {
    setWelcomeMessage('Welcome message updated at ' + new Date().toLocaleTimeString());
  };

  return (
    <div className="space-y-6 p-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
        <p className="text-gray-600 mb-4">{welcomeMessage}</p>
        
        <div className="flex space-x-4">
          <button
            onClick={handleUpdateWelcome}
            className="bg-sky-500 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded"
          >
            Update Welcome Message
          </button>
          
          <button
            onClick={handleAddSampleData}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Add Sample Data
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Data</h2>
        
        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            Error: {error}
          </div>
        )}
        
        {!loading && !error && (
          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No data found. Add some data to get started!
              </p>
            ) : (
              items.slice(0, 5).map((item) => (
                <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {item.title || item.type || 'Untitled'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {item.content || 'No content'}
                      </p>
                      <div className="flex space-x-2 mt-2">
                        {item.tags && item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;