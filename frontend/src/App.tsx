import React, { useEffect, useRef, useState, useMemo } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { QuillBinding } from 'y-quill'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { Users, Wifi, WifiOff } from 'lucide-react'
import QuillCursors from 'quill-cursors'

Quill.register('modules/cursors', QuillCursors)

const COLORS = ['#f56565', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#6366f1', '#ec4899']

const App: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<number>(1)
  const [userList, setUserList] = useState<any[]>([])
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected')

  // Generate a random name and color for the current user
  const currentUser = useMemo(() => {
    return {
      name: `User-${Math.floor(Math.random() * 1000)}`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    }
  }, [])

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

    provider.on('status', (event: { status: string }) => {
      setStatus(event.status as 'connected' | 'disconnected')
    })

    // 3. Initialize Quill with cursors module
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        cursors: true,
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ script: 'super' }, { script: 'sub' }],
          ['blockquote', 'code-block'],
          [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
          [{ direction: 'rtl' }, { align: [] }],
          ['link', 'image', 'video', 'formula'],
          ['clean']
        ],
      },
    })
    quillRef.current = quill

    // 4. Handle Awareness (User presence & Cursors)
    const awareness = provider.awareness
    
    // Set local state
    awareness.setLocalStateField('user', currentUser)

    awareness.on('change', () => {
      const states = Array.from(awareness.getStates().values())
      
      const users = states
        .filter(state => state.user)
        .map(state => state.user)
      
      setUserList(users)
      setOnlineUsers(users.length || 1)
    })

    // 5. Bind Yjs to Quill (This will also bind cursors automatically if the module is registered)
    const type = ydoc.getText('quill')
    const binding = new QuillBinding(type, quill, awareness)

    // Sync formats to type
    quill.on('text-change', () => {
        // Yjs will automatically sync text changes. 
        // Formatting is handled correctly by QuillBinding.
    });

    return () => {
      binding.destroy()
      provider.destroy()
      ydoc.destroy()
    }
  }, [currentUser])

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm">
        <h1 className="text-xl font-bold text-gray-800">实时协作文档</h1>
        
        <div className="flex items-center space-x-6">
          {/* Active Users Display */}
          <div className="flex -space-x-2 overflow-hidden">
             {userList.slice(0, 5).map((user, idx) => (
               <div 
                  key={idx} 
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white flex items-center justify-center text-xs text-white font-bold"
                  style={{ backgroundColor: user.color }}
                  title={user.name}
               >
                 {user.name.substring(0, 1)}
               </div>
             ))}
             {userList.length > 5 && (
                <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-bold">
                  +{userList.length - 5}
                </div>
             )}
          </div>

          <div className="flex items-center text-sm text-gray-600 border-l pl-4">
            <Users size={18} className="mr-2" />
            <span>在线: {onlineUsers}</span>
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
      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <div className="bg-white border border-gray-200 shadow-md rounded-lg overflow-hidden flex flex-col h-[calc(100vh-120px)]">
          <div ref={editorRef} className="flex-1 overflow-y-auto" />
        </div>
      </main>
    </div>
  )
}

export default App
