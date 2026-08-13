import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { useApp } from '../store';
import { TaskRow } from './TaskRow';
import { Empty } from './Empty';

export function SearchOverlay({
  onClose,
  onOpenDetail,
}: {
  onClose: () => void;
  onOpenDetail: (id: string) => void;
}) {
  const { state } = useApp();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return state.tasks
      .filter((t) => {
        if (t.title.toLowerCase().includes(query)) return true;
        if (t.notes.toLowerCase().includes(query)) return true;
        return t.tags.some((tag) => tag.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const at = a.title.toLowerCase().startsWith(query) ? 0 : 1;
        const bt = b.title.toLowerCase().startsWith(query) ? 0 : 1;
        if (at !== bt) return at - bt;
        return b.createdAt - a.createdAt;
      });
  }, [q, state.tasks]);

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="search-bar">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭搜索">
            <ArrowLeft size={18} />
          </button>
          <Search size={17} className="search-ico" />
          <input
            ref={inputRef}
            type="search"
            placeholder="搜索任务、备注或标签…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button type="button" className="icon-btn" onClick={() => setQ('')} aria-label="清空">
              ✕
            </button>
          )}
        </div>
        <div className="search-results">
          {q.trim() === '' ? (
            <Empty
              icon={<Search size={30} />}
              title="搜索全部任务"
              hint="支持按标题、备注、标签搜索"
            />
          ) : results.length === 0 ? (
            <Empty icon={<Search size={30} />} title="没有找到相关任务" hint="换个关键词试试" />
          ) : (
            <div className="task-list">
              {results.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  showList
                  onOpen={() => {
                    onOpenDetail(t.id);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
