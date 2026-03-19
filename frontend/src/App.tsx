import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { QuillBinding } from 'y-quill'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { Users, Wifi, WifiOff } from 'lucide-react'
import QuillCursors from 'quill-cursors'

Quill.register('modules/cursors', QuillCursors)

const COLORS = ['#f56565', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#6366f1', '#ec4899']

type UserInfo = {
  name: string
  color: string
}

type Notification = {
  id: string
  msg: string
}

const App: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<number>(1)
  const [userList, setUserList] = useState<UserInfo[]>([])
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [isSynced, setIsSynced] = useState<boolean>(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const prevClientsRef = useRef<Set<number>>(new Set())

  const docName = useMemo(() => {
    return new URLSearchParams(window.location.search).get('doc') || 'collaborative-doc'
  }, [])

  const currentUser = useMemo(() => {
    return {
      name: `User-${Math.floor(Math.random() * 1000)}`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    }
  }, [])

  useEffect(() => {
    if (!editorRef.current) return

    const ydoc = new Y.Doc()
    
    // Agent-C: IndexedDB Persistence
    const indexeddbProvider = new IndexeddbPersistence(docName, ydoc)
    indexeddbProvider.on('synced', () => setIsSynced(true))

    const provider = new WebsocketProvider(
      'ws://localhost:1234',
      docName,
      ydoc
    )

    provider.on('status', (event: { status: string }) => {
      setWsStatus(event.status === 'connected' ? 'connected' : 'disconnected')
      if (event.status === 'connected') {
        provider.awareness.setLocalStateField('user', currentUser)
      }
    })

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
    ;(window as any).__quill = quill
    ;(window as any).quill = quill

    const awareness = provider.awareness

    const pushNotification = (msg: string) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      setNotifications(prev => [...prev, { id, msg }])
      window.setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }, 3000)
    }

    const syncPresence = () => {
      const states = awareness.getStates()
      const users: UserInfo[] = []
      const currentClients = new Set<number>()

      for (const [clientId, state] of states.entries()) {
        currentClients.add(clientId)
        if (state?.user) users.push(state.user as UserInfo)
      }

      for (const clientId of currentClients) {
        if (!prevClientsRef.current.has(clientId)) {
          const u = states.get(clientId)?.user as UserInfo | undefined
          if (u) pushNotification(`${u.name} 已加入`)
        }
      }

      for (const clientId of prevClientsRef.current) {
        if (!currentClients.has(clientId)) {
          pushNotification(`用户已离开`)
        }
      }

      prevClientsRef.current = currentClients
      setUserList(users)
      setOnlineUsers(users.length || 1)
    }

    awareness.setLocalStateField('user', currentUser)
    syncPresence()
    awareness.on('change', syncPresence)

    const type = ydoc.getText('quill')
    const binding = new QuillBinding(type, quill, awareness)

    // Agent-C: Last-Write-Wins (LWW) Strategy
    const lwwMap = ydoc.getMap('lww')
    const applyingLwwRef = { current: false }
    const appliedTsRef = { current: 0 }

    const applyLww = () => {
      const raw = lwwMap.get('last')
      if (typeof raw !== 'string') return
      let parsed: { ts: number; delta: unknown } | null = null
      try {
        parsed = JSON.parse(raw) as { ts: number; delta: unknown }
      } catch {
        parsed = null
      }
      if (!parsed || typeof parsed.ts !== 'number' || parsed.ts <= appliedTsRef.current) return
      applyingLwwRef.current = true
      try {
        quill.setContents(parsed.delta as any, 'api')
        appliedTsRef.current = parsed.ts
      } finally {
        applyingLwwRef.current = false
      }
    }

    const lwwObserver = () => applyLww()
    lwwMap.observe(lwwObserver)
    applyLww()

    let lwwTimeout: number | null = null
    const onTextChange = (_delta: unknown, _old: unknown, source: unknown) => {
      if (source !== 'user') return
      if (applyingLwwRef.current) return
      
      // Debounce LWW update to allow CRDT to work for real-time typing
      if (lwwTimeout) window.clearTimeout(lwwTimeout)
      lwwTimeout = window.setTimeout(() => {
        const payload = JSON.stringify({ ts: Date.now(), delta: quill.getContents() })
        lwwMap.set('last', payload)
      }, 1000)
    }
    quill.on('text-change', onTextChange as any)

    // Agent-C: Offline Status Detection
    const handleOnline = () => setIsBrowserOnline(true)
    const handleOffline = () => setIsBrowserOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      quill.off('text-change', onTextChange as any)
      lwwMap.unobserve(lwwObserver)
      binding.destroy()
      provider.destroy()
      indexeddbProvider.destroy()
      ydoc.destroy()
    }
  }, [currentUser, docName])

  const status = isBrowserOnline && wsStatus === 'connected' ? 'connected' : 'disconnected'

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(n => (
          <div key={n.id} className="notification-toast bg-white border shadow-sm rounded-md px-4 py-2 text-sm text-gray-700">
            {n.msg}
          </div>
        ))}
      </div>
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm">
        <h1 className="text-xl font-bold text-gray-800">实时协作文档</h1>
        
        <div className="flex items-center space-x-6">
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

          <div className="online-users-list hidden">
            {userList.map((user, idx) => (
              <span key={idx} className="online-user">
                {user.name}
              </span>
            ))}
          </div>
          
          <div className={`flex items-center text-sm font-medium ${
            status === 'connected' ? 'text-green-600' : 'text-red-600'
          }`}>
            {status === 'connected' ? (
              <><Wifi size={18} className="mr-2" /> 在线</>
            ) : (
              <><WifiOff size={18} className="mr-2" /> 离线模式</>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <div className="bg-white border border-gray-200 shadow-md rounded-lg overflow-hidden flex flex-col h-[calc(100vh-120px)]">
          <div ref={editorRef} className="flex-1 overflow-y-auto" />
        </div>
        <div className="mt-2 text-xs text-gray-400">{isSynced ? '已从本地恢复' : '本地恢复中'}</div>
      </main>
    </div>
  )
}

export default App
