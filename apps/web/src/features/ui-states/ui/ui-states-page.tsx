const TASK_VARIANTS = [
  {
    title: 'Task: default',
    description: 'Standard card state with normal priority.',
    tone: 'border-slate-700 bg-slate-950',
  },
  {
    title: 'Task: blocked',
    description: 'Blocked by dependency from another team.',
    tone: 'border-rose-700/70 bg-rose-950/20',
  },
  {
    title: 'Task: pending mutation',
    description: 'Waiting for server confirmation...',
    tone: 'border-amber-600/70 bg-amber-950/20',
  },
]

const COLUMN_VARIANTS = [
  {
    title: 'Backlog',
    cards: 14,
    tone: 'border-slate-700',
  },
  {
    title: 'Doing',
    cards: 5,
    tone: 'border-cyan-700/60',
  },
  {
    title: 'Done',
    cards: 38,
    tone: 'border-emerald-700/60',
  },
]

function StateCard({
  title,
  description,
  tone = 'border-slate-700 bg-slate-900/70',
}: {
  title: string
  description: string
  tone?: string
}) {
  return (
    <article className={`rounded-xl border p-4 ${tone}`}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-2 text-xs text-slate-300">{description}</p>
    </article>
  )
}

export function UiStatesPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-wide text-cyan-400">Visual State Coverage</p>
          <h1 className="mt-2 text-3xl font-bold">UI State Gallery</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            This screen is an in-repo visual reference for critical UX states and interaction feedback.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StateCard title="Empty board" description="No columns yet. Prompt the user to create first column." />
          <StateCard title="Loading board" description="Skeleton placeholders while snapshot request is in flight." />
          <StateCard
            title="Load error"
            description="Request failed. Show explicit retry action with contextual error messaging."
            tone="border-rose-700/70 bg-rose-950/20"
          />
          <StateCard
            title="Disconnected"
            description="Realtime status is offline; editing should be treated as degraded."
            tone="border-amber-700/70 bg-amber-950/20"
          />
          <StateCard
            title="Reconnecting"
            description="Socket reconnect in progress with sequence-based replay recovery."
            tone="border-cyan-700/70 bg-cyan-950/20"
          />
          <StateCard
            title="Permission locked"
            description="Viewer role cannot mutate board state. Actions are disabled with explanatory label."
          />
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold">Board Header States</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              Realtime: connected
            </span>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
              Realtime: reconnecting
            </span>
            <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-300">
              Realtime: disconnected
            </span>
            <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
              2 collaborators dragging
            </span>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold">Task Card Variants</h2>
            <ul className="mt-4 space-y-3">
              {TASK_VARIANTS.map((task) => (
                <li key={task.title} className={`rounded-lg border px-3 py-2 ${task.tone}`}>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="mt-1 text-xs text-slate-300">{task.description}</p>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold">Column Variants</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {COLUMN_VARIANTS.map((column) => (
                <li key={column.title} className={`rounded-lg border bg-slate-950 px-3 py-3 ${column.tone}`}>
                  <p className="text-sm font-semibold">{column.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{column.cards} cards</p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <StateCard
            title="Rollback feedback"
            description="Mutation accepted locally, rejected by server. UI restores previous snapshot and raises error toast."
            tone="border-rose-700/70 bg-rose-950/20"
          />
          <StateCard
            title="Latency / pending mutation"
            description="Action disabled while mutation is in-flight; show subtle pending status to reduce duplicate actions."
            tone="border-amber-700/70 bg-amber-950/20"
          />
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold">Toast / Banner Variants</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-700/70 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300">
              Success: Column created
            </div>
            <div className="rounded-lg border border-amber-700/70 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
              Warning: Viewer role cannot edit
            </div>
            <div className="rounded-lg border border-rose-700/70 bg-rose-950/20 px-3 py-2 text-xs text-rose-300">
              Error: Failed to move card
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
