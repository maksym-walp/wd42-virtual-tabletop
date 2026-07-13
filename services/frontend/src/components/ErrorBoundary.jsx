import { Component } from 'react';

// Without this, an uncaught render-phase error (e.g. a bad state update
// during a drag/pan gesture) unmounts the whole React tree and leaves a
// blank white page with no way back except a manual reload.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
          <p className="font-display text-xl text-accent">Сталася помилка</p>
          <p className="max-w-sm text-sm text-text-dim">
            Щось пішло не так під час відображення сторінки. Спробуйте оновити її.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-bg hover:opacity-90"
          >
            Оновити сторінку
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
