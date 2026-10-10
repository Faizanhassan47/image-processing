import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <section className="feature-error" role="alert">
      <h2>{this.props.title || 'This section could not be displayed'}</h2>
      <p>{this.state.error.message}</p>
      <button type="button" className="btn-control-secondary" onClick={() => this.setState({ error: null })}>Try again</button>
    </section>;
    return this.props.children;
  }
}
