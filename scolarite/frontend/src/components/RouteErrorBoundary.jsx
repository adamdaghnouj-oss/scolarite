import { Component } from "react";

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Intentionally silent; keep UI alive with fallback.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", color: "#0f172a", fontFamily: "Inter, sans-serif" }}>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ margin: "0 0 8px" }}>Messaging temporarily unavailable</h2>
            <p style={{ margin: 0, color: "#64748b" }}>Please refresh the page.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
