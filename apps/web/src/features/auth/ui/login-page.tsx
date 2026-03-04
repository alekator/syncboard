import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { boardRoleSchema, loginBodySchema } from '@syncboard/shared'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { login } from '@/features/auth/api/auth-api'
import { useSessionStore } from '@/features/auth/model/session-store'

const loginFormSchema = loginBodySchema.extend({
  role: boardRoleSchema,
})

type LoginForm = z.infer<typeof loginFormSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const token = useSessionStore((state) => state.token)
  const setSession = useSessionStore((state) => state.setSession)

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      name: '',
      role: 'owner',
    },
  })

  const loginMutation = useMutation({
    mutationFn: (values: LoginForm) => login(values),
    onSuccess: (session) => {
      setSession(session)
      void navigate('/', { replace: true })
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    loginMutation.mutate(values)
  })

  if (token) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-2xl font-bold">Sign in to SyncBoard</h1>
        <p className="mt-1 text-sm text-slate-300">Dev auth for collaboration sessions</p>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <input
            {...form.register('name')}
            placeholder="Your name"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />
          <select
            {...form.register('role')}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          >
            <option value="owner">owner</option>
            <option value="editor">editor</option>
            <option value="viewer">viewer</option>
          </select>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {form.formState.errors.name ? (
          <p className="mt-2 text-sm text-rose-400">{form.formState.errors.name.message}</p>
        ) : null}
        {loginMutation.isError ? (
          <p className="mt-2 text-sm text-rose-400">Unable to sign in. Try again.</p>
        ) : null}
      </section>
    </main>
  )
}
