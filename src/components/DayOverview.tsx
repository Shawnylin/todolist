import { useApp } from '../store';
import { todayISO, toISODate } from '../utils/date';
export function DayOverview() {
  const { state } = useApp();
  const today = todayISO();
  const allTasks = state.tasks.filter((t) =>
    t.done
      ? !!t.completedAt && toISODate(new Date(t.completedAt)) === today
      : !t.due || t.due <= today,
  );
  const hasAny = allTasks.length > 0;
  const completed = allTasks.filter((t) => t.done).length;
  const progress = hasAny ? Math.round((completed / allTasks.length) * 100) : 0;
  return (
    <section className="day-overview" aria-label="当日进度">
      <div>
        <span className="eyebrow">ONE THING AT A TIME</span>
        <h2>
          {hasAny && completed === allTasks.length
            ? '做得好，留一点时间给自己。'
            : '慢慢来，也在向前。'}
        </h2>
        <p>
          {hasAny
            ? `还有 ${allTasks.length - completed} 件待办，已完成 ${completed} 件`
            : '从一件小事开始，安排属于你的一天。'}
        </p>
      </div>
      <div
        className="day-progress"
        role="progressbar"
        aria-label="任务完成进度"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="progress-track" cx="50" cy="50" r="42" />
          <circle
            className="progress-value"
            cx="50"
            cy="50"
            r="42"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={100 - progress}
          />
        </svg>
        <span>
          {progress}
          <small>%</small>
        </span>
      </div>
    </section>
  );
}
