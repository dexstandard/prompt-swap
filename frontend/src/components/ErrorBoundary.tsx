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
        <div className="bg-white shadow-md border border-gray-200 rounded p-6 flex-1 min-w-0 flex flex-col">
          <h2 className="text-xl font-bold mb-4">Price History</h2>
          <div className="flex-1 flex items-center justify-center text-red-500">
            Failed to render chart
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

