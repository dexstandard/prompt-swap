import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white shadow-md rounded p-6 w-full max-w-xl">
          <h2 className="text-xl font-bold mb-4">Price History</h2>
          <div className="h-[512px] flex items-center justify-center text-red-500">
            Failed to render chart
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

