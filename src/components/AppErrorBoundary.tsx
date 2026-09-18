import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Heart, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('KnotYet render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-[100dvh] grid place-items-center bg-[#fbf7f1] p-6 text-center">
        <div className="w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-8 shadow-xl shadow-stone-900/10">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-600">
            <Heart className="h-7 w-7" fill="currentColor" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">We lost the thread for a moment.</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-stone-500">Your saved profile is safe. Reload the app to reconnect and continue.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-3.5 text-sm font-black text-white transition hover:bg-stone-800 active:scale-[.98]">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reload KnotYet
          </button>
        </div>
      </main>
    );
  }
}