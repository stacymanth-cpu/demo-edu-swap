import { useMemo, useState, type ChangeEvent } from 'react';
import { Plus } from 'lucide-react';
import { getSkillIcon } from '../lib/iconMap';
import type { SkillInfo } from '../types';

interface SkillPickerProps {
  label: string;
  allSkillsInfo: SkillInfo[];
  currentSkills: string[];
  onAddSkills: (skills: string[]) => void;
  buttonId?: string;
  defaultOpen?: boolean;
}

export function SkillPicker({ label, allSkillsInfo, currentSkills, onAddSkills, buttonId, defaultOpen }: SkillPickerProps) {
  const [showPicker, setShowPicker] = useState(defaultOpen ?? false);
  const [pickerCategory, setPickerCategory] = useState<string>('All');
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [tempSelection, setTempSelection] = useState<string[]>([]);

  const categories = useMemo(
    () => Array.from(new Set(allSkillsInfo.map(skill => skill.category))).filter(Boolean),
    [allSkillsInfo],
  );

  const filteredSkills = useMemo(
    () => allSkillsInfo.filter(skill => {
      const matchesCategory = pickerCategory === 'All' || skill.category === pickerCategory;
      const matchesSearch = skill.name.toLowerCase().includes(pickerSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    }),
    [allSkillsInfo, pickerCategory, pickerSearch],
  );

  const toggleTempSelection = (name: string) => {
    setTempSelection(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
  };

  const addSelectedSkills = () => {
    if (!tempSelection.length) return;
    onAddSkills([...currentSkills, ...tempSelection.filter(s => !currentSkills.includes(s))]);
    setTempSelection([]);
    setShowPicker(false);
  };

  return (
    <div className="skill-picker-wrapper">
      <button
        type="button"
        className="picker-toggle"
        onClick={() => setShowPicker(prev => !prev)}
        id={buttonId}
      >
        {showPicker ? `Close ${label} skills` : `Choose ${label} skills`}
      </button>

      {showPicker && (
        <div className="skill-picker" role="dialog" aria-label={`${label} skill list`}>
          <div className="picker-controls">
            <select value={pickerCategory} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPickerCategory(e.target.value)}>
              <option value="All">All categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <input
              type="search"
              placeholder="Search skills..."
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              className="picker-search"
              aria-label={`Search ${label.toLowerCase()} skills`}
            />
          </div>

          {filteredSkills.length === 0 ? (
            <div className="skill-picker-empty">No matching skills — type to search or add a custom skill</div>
          ) : (
            <div className="skill-list">
              {filteredSkills.map(skill => {
                const selected = tempSelection.includes(skill.name);
                return (
                  <button
                    key={skill.name}
                    type="button"
                    className={`skill-option ${selected ? 'selected' : ''}`}
                    onClick={() => toggleTempSelection(skill.name)}
                    aria-pressed={selected}
                  >
                    <span className="skill-option-icon">{getSkillIcon(skill.icon, 18)}</span>
                    <span className="skill-option-text">
                      <span>{skill.name}</span>
                      <span className="skill-option-meta">{skill.category}</span>
                    </span>
                    {selected && <span className="skill-option-status">Selected</span>}
                  </button>
                );
              })}
            </div>
          )}

          <div className="picker-footer">
            <button type="button" className="picker-add-btn" onClick={addSelectedSkills} disabled={!tempSelection.length}>
              <Plus size={16} /> Add selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
