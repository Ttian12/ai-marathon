import React, { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { QuillBinding } from 'y-quill'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { Users, Wifi, WifiOff } from 'lucide-react'

const App: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<number>(0)
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected')

  useEffect(() => {
    if (!editorRef.current) return

    // 1. Initialize Yjs
    const ydoc = new Y.Doc()
    
    // 2. Setup WebSocket Provider
    const provider = new WebsocketProvider(
      'ws://localhost:1234', 
      'collaborative-doc', 
      ydoc
    )

    provider.on('status', (event: any) => {
      setStatus(event.status === 'connected' ? 'connected' : 'disconnected')
    })

    // 3. Handle Awareness (User presence)
    provider.awareness.on('change', () => {
      setOnlineUsers(provider.awareness.getStates().size)
    })

    // 4. Initialize Quill
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline'],
          ['link', 'blockquote', 'code-block'],
          [{ list: 'ordered' }, { list: 'bullet' }],
        ],
      },
    })
    quillRef.current = quill

    // 5. Bind Yjs to Quill
    const type = ydoc.getText('quill')
    const binding = new QuillBinding(type, quill, provider.awareness)

    return () => {
      binding.destroy()
      provider.destroy()
      ydoc.destroy()
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <h1 className="text-xl font-bold text-gray-800">实时协作文档</h1>
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center text-sm text-gray-600">
            <Users size={18} className="mr-2" />
            <span>在线用户: {onlineUsers}</span>
          </div>
          
          <div className={`flex items-center text-sm font-medium ${
            status === 'connected' ? 'text-green-600' : 'text-red-600'
          }`}>
            {status === 'connected' ? (
              <><Wifi size={18} className="mr-2" /> 在线</>
            ) : (
              <><WifiOff size={18} className="mr-2" /> 离线</>
            )}
          </div>
        </div>
      </header>

      {/* Editor Container */}
      <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <div className="bg-white border shadow-sm rounded-lg overflow-hidden min-h-[500px]">
          <div ref={editorRef} />
        </div>
      </main>
    </div>
  )
}

export default App
