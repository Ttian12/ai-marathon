import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { QuillBinding } from 'y-quill'
import Quill from 'quill'
import QuillCursors from 'quill-cursors'
import 'quill/dist/quill.snow.css'
import 'quill-cursors/css'
import { Users, Wifi, WifiOff } from 'lucide-react'

Quill.register('modules/cursors', QuillCursors)

interface UserInfo {
  name: string;
  color: string;
}

const colors = ['#f56222', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f43f5e'];

const App: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<number>(0)
  const [onlineUsersList, setOnlineUsersList] = useState<UserInfo[]>([])
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [notifications, setNotifications] = useState<{id: string, msg: string}[]>([])
  
  const prevStatesRef = useRef<Map<number, any>>(new Map())

  const addNotification = useCallback((msg: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

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

    // Set user info
    const randomName = '用户' + Math.floor(Math.random() * 1000);
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    provider.awareness.setLocalStateField('user', {
      name: randomName,
      color: randomColor
    });

    provider.on('status', (event: any) => {
      setStatus(event.status === 'connected' ? 'connected' : 'disconnected')
    })

    // 3. Handle Awareness (User presence)
    provider.awareness.on('change', (changes: { added: number[], updated: number[], removed: number[] }) => {
      const states = provider.awareness.getStates();
      
      changes.added.forEach(clientId => {
        if (clientId !== provider.awareness.clientID) {
          const state = states.get(clientId);
          if (state?.user?.name) {
            addNotification(`${state.user.name} 已加入`);
          }
        }
      });

      changes.removed.forEach(clientId => {
        const prevState = prevStatesRef.current.get(clientId);
        if (prevState?.user?.name) {
          addNotification(`${prevState.user.name} 已离开`);
        }
      });
      
      prevStatesRef.current = new Map(states);
      
      const currentUsers: UserInfo[] = [];
      states.forEach(state => {
        if (state.user) {
          currentUsers.push(state.user);
        }
      });
      setOnlineUsersList(currentUsers);
      setOnlineUsers(states.size);
    })

    // 4. Initialize Quill
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        cursors: true,
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline'],
          ['link', 'blockquote', 'code-block'],
          [{ list: 'ordered' }, { list: 'bullet' }],
        ],
      },
    })
    quillRef.current = quill
    ;(window as any).quill = quill

    // 5. Bind Yjs to Quill
    const type = ydoc.getText('quill')
    const binding = new QuillBinding(type, quill, provider.awareness)

    return () => {
      binding.destroy()
      provider.destroy()
      ydoc.destroy()
    }
  }, [addNotification])

  return (
    <div className="min-h-screen flex flex-col bg-white relative">
      {/* Notifications */}
      <div className="fixed top-20 right-4 space-y-2 z-50">
        {notifications.map(n => (
          <div key={n.id} className="notification-toast bg-white border shadow-sm rounded-md px-4 py-2 text-sm text-gray-700">
            {n.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <h1 className="text-xl font-bold text-gray-800">实时协作文档</h1>
        
        <div className="flex items-center space-x-6">
          <div className="flex flex-col text-sm text-gray-600">
            <div className="flex items-center mb-1">
              <Users size={18} className="mr-2" />
              <span>在线用户: {onlineUsers}</span>
            </div>
            <div className="online-users-list flex space-x-2">
              {onlineUsersList.map((u, i) => (
                <span key={i} className="online-user text-xs font-medium px-2 py-1 rounded-full bg-gray-200" style={{ color: u.color }}>
                  {u.name}
                </span>
              ))}
            </div>
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
