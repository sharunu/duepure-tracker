"use client";

import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4">
          <p className="text-red-400 text-[14px] mb-4">
            エラーが発生しました。ページを再読み込みしてください。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-[8px] bg-[#6366f1] px-4 py-2 text-[13px] text-white hover:opacity-90 transition-opacity"
          >
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
