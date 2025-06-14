import React, { useState, useEffect } from 'react';
import { keys } from 'ts-transformer-keys';

import type { Chore } from '@customTypes/SharedTypes';

const AddChoreForm = ({ onSubmit, onCancel }) => {
  const columns = keys<Chore>();

  const [formData, setFormData] = useState({});

  useEffect(() => {
    // Reset form when table changes
    const initialData = {};
    if (columns) {
      columns.forEach(col => {
        initialData[col.name] = '';
      });
    }
    setFormData(initialData);
  }, [columns]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!columns) return null;

  return (
    <div className="data-point-entry-form">
      <h3>Add New Chore</h3>
      <form onSubmit={handleSubmit}>
        {columns.map((col, i) => (
          <div key={col.name} className="form-group">
            <label>{col.name}:</label>
            <input
              type={col.type === 'INTEGER' || col.type === 'REAL' ? 'number' : 'text'}
              name={col.name}
              value={formData[col.name] || ''}
              onChange={handleChange}
              required={!col.nullable}
              autoFocus={i === 0}
            />
          </div>
        )
        )}
        <div className="form-buttons">
          <button type="submit">Save</button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default AddChoreForm;