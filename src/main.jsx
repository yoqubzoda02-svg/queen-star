import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background:'#0A0908', color:'#F2EDE4', minHeight:'100vh', padding:20, fontFamily:'sans-serif' }}>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:10 }}>Что-то сломалось</div>
          <div style={{ fontSize:13, opacity:0.8, marginBottom:14 }}>Отправьте этот текст разработчику:</div>
          <div style={{ fontSize:12, opacity:0.7, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{String(this.state.error?.stack || this.state.error)}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
