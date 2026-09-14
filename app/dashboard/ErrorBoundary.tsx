'use client'
import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode; label?: string }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', minHeight:200, padding:32, gap:12, color:'#64748b' }}>
          <div style={{ fontSize:28 }}>⚠️</div>
          <div style={{ fontSize:14, fontWeight:600, color:'#cbd5e1' }}>
            {this.props.label ?? 'Tab'} is gecrasht
          </div>
          <div style={{ fontSize:11, color:'#475569', maxWidth:320, textAlign:'center', lineHeight:1.6 }}>
            {error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop:4, padding:'6px 16px', borderRadius:8, background:'rgba(99,102,241,.12)', border:'1px solid rgba(99,102,241,.3)', color:'#818cf8', cursor:'pointer', fontSize:12 }}
          >
            Opnieuw proberen
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
