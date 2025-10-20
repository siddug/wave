import React, { useState, useEffect } from 'react';
import { useElectronData } from '../hooks/useElectronData';

const NotesPage = () => {
  const { items, loading, error, fetchData, addData, updateData, deleteData } = useElectronData();
  const [newNote, setNewNote] = useState({ title: '', content: '', tags: '' });
  const [editingNote, setEditingNote] = useState(null);

  useEffect(() => {
    fetchData({ filters: { type: 'note' } });
  }, [fetchData]);

  const noteItems = items.filter(item => item.type === 'note');

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNote.title.trim()) return;

    const tags = newNote.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    
    addData({
      type: 'note',
      title: newNote.title.trim(),
      content: newNote.content.trim(),
      tags
    });

    setNewNote({ title: '', content: '', tags: '' });
  };

  const handleEditNote = (note) => {
    setEditingNote({
      ...note,
      tags: note.tags ? note.tags.join(', ') : ''
    });
  };

  const handleUpdateNote = (e) => {
    e.preventDefault();
    if (!editingNote.title.trim()) return;

    const tags = editingNote.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    
    updateData(editingNote.id, {
      title: editingNote.title.trim(),
      content: editingNote.content.trim(),
      tags
    });

    setEditingNote(null);
  };

  const handleDeleteNote = (id) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      deleteData(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Notes</h1>
        
        {/* Add New Note Form */}
        <form onSubmit={handleAddNote} className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={newNote.title}
              onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter note title..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <textarea
              value={newNote.content}
              onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter note content..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={newNote.tags}
              onChange={(e) => setNewNote({ ...newNote, tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tag1, tag2, tag3..."
            />
          </div>
          
          <button
            type="submit"
            className="bg-sky-500 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded"
          >
            Add Note
          </button>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading notes...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            Error: {error}
          </div>
        )}

        {/* Notes List */}
        {!loading && !error && (
          <div className="space-y-4 p-6">
            {noteItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No notes found. Create your first note above!
              </p>
            ) : (
              noteItems.map((note) => (
                <div key={note.id} className="border rounded-lg p-4 bg-gray-50">
                  {editingNote && editingNote.id === note.id ? (
                    /* Edit Form */
                    <form onSubmit={handleUpdateNote} className="space-y-3">
                      <input
                        type="text"
                        value={editingNote.title}
                        onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <textarea
                        value={editingNote.content}
                        onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={editingNote.tags}
                        onChange={(e) => setEditingNote({ ...editingNote, tags: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Tags (comma-separated)"
                      />
                      <div className="flex space-x-2">
                        <button
                          type="submit"
                          className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNote(null)}
                          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Note Display */
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-medium text-gray-900">{note.title}</h3>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditNote(note)}
                            className="text-sky-600 hover:text-sky-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-gray-700 mb-3 whitespace-pre-wrap">{note.content}</p>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex space-x-2">
                          {note.tags && note.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(note.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesPage;