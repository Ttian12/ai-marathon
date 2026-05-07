import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { QuillBinding } from 'y-quill'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { Users, Wifi, WifiOff, History, X, RotateCcw } from 'lucide-react'
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
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false)
  const [versions, setVersions] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false)
  const prevClientsRef = useRef<Set<number>>(new Set())

  const docName = useMemo(() => {
    return new URLSearchParams(window.location.search).get('doc') || 'collaborative-doc'
  }, [])

  const apiOrigin = useMemo(() => {
    const envOrigin = (import.meta as any).env?.VITE_API_ORIGIN as string | undefined
    if (envOrigin) return envOrigin
    const host = window.location.hostname
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
    return `${protocol}//${host}:1234`
  }, [])

  const wsOrigin = useMemo(() => {
    const envOrigin = (import.meta as any).env?.VITE_WS_ORIGIN as string | undefined
    if (envOrigin) return envOrigin
    const host = window.location.hostname
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${host}:1234`
  }, [])

  const currentUser = useMemo(() => {
    return {
      name: `User-${Math.floor(Math.random() * 1000)}`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    }
  }, [])

  const fetchVersions = async () => {
    setIsLoadingHistory(true)
    try {
      const res = await fetch(`${apiOrigin}/api/versions/${docName}`)
      const data = await res.json()
      setVersions(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch versions:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleRollback = async (id: number) => {
    try {
      const res = await fetch(`${apiOrigin}/api/rollback/${docName}/${id}`, {
        method: 'POST'
      })
      if (res.ok) {
        setIsHistoryOpen(false)
        pushNotification('已成功回滚到历史版本')
      } else {
        alert('回滚失败')
      }
    } catch (err) {
      console.error('Rollback error:', err)
    }
  }

  const pushNotification = (msg: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setNotifications(prev => [...prev, { id, msg }])
    window.setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 3000)
  }

  useEffect(() => {
    if (!editorRef.current) return
    
    // Prevent multiple quill instances from being created
    if (quillRef.current) return

    const ydoc = new Y.Doc()
    
    // Agent-C: IndexedDB Persistence
    const indexeddbProvider = new IndexeddbPersistence(docName, ydoc)
    // 移除之前的直接设置 setIsSynced，统一移到下面处理

    const provider = new WebsocketProvider(
      wsOrigin,
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
    
    // 增加一个标记，防止在 IndexedDB 尚未同步完成时就处理 LWW，避免冲突
    let indexedDbSynced = false
    indexeddbProvider.on('synced', () => {
      setIsSynced(true)
      indexedDbSynced = true
      // IndexedDB 恢复完成后，尝试发送自己的离线更新（如果有）
      const lastLocalTs = Number(localStorage.getItem('lww_ts') || 0)
      const lastLocalDelta = localStorage.getItem('lww_delta')
      if (lastLocalTs > 0 && lastLocalDelta && lastLocalTs > appliedTsRef.current) {
        const parsedDelta = JSON.parse(lastLocalDelta)
        const currentDelta = quill.getContents()
        
        // 只有当本地离线内容确实比当前 ydoc 内容新且不同时，才发起宣告
        if (JSON.stringify(currentDelta) !== JSON.stringify(parsedDelta)) {
          lwwMap.set('last', JSON.stringify({
            ts: lastLocalTs,
            clientId: ydoc.clientID,
            delta: parsedDelta
          }))
        }
      }
      applyLww()
    })

    const applyLww = () => {
      // 如果本地存储还没加载完，先不应用 LWW 避免冲突
      if (!indexedDbSynced) return
      
      const raw = lwwMap.get('last')
      if (typeof raw !== 'string') return
      let parsed: { ts: number; clientId: number; delta: unknown } | null = null
      try {
        parsed = JSON.parse(raw) as { ts: number; clientId: number; delta: unknown }
      } catch {
        parsed = null
      }
      
      if (!parsed || typeof parsed.ts !== 'number') return
      
      // 1. 如果收到的时间戳比本地已应用的小，说明是旧消息，忽略
      if (parsed.ts < appliedTsRef.current) return
      
      // 2. 如果时间戳相等，根据 clientId 强制决定胜出者（保证分布式一致性，不冲突）
      if (parsed.ts === appliedTsRef.current && parsed.clientId < ydoc.clientID) return

      // 更新本地已应用的时间戳
      appliedTsRef.current = parsed.ts

      // 3. 核心修复：只有 LWW 的发起者（Winner）才负责将自己的内容同步到共享 Y.Text
      // 其他客户端只需要更新自己的 appliedTsRef 即可，内容会通过 Yjs 正常的同步机制到达。
      // 之前的代码在这里判断错误，导致了重复执行或者没人执行。
      if (parsed.clientId !== ydoc.clientID) return

      const currentDelta = quill.getContents()
      // 增加深度比较，如果内容已经一致，则不触发重置
      if (JSON.stringify(currentDelta) === JSON.stringify(parsed.delta)) return

      applyingLwwRef.current = true
      try {
        // 胜出者强制重置共享状态
        ydoc.transact(() => {
          const text = ydoc.getText('quill')
          if (text.length > 0) {
            text.delete(0, text.length)
          }
          quill.setContents(parsed.delta as any, 'api')
        })
      } finally {
        applyingLwwRef.current = false
      }
    }

    const lwwObserver = () => applyLww()
    lwwMap.observe(lwwObserver)
    applyLww()

    let lwwTimeout: any = null
    const onTextChange = (_delta: unknown, _old: unknown, source: unknown) => {
      if (source !== 'user') return
      if (applyingLwwRef.current) return
      
      if (lwwTimeout) clearTimeout(lwwTimeout)
      lwwTimeout = setTimeout(() => {
        const ts = Date.now()
        const delta = quill.getContents()
        // 本地存储备份，用于离线恢复时比对
        localStorage.setItem('lww_ts', ts.toString())
        localStorage.setItem('lww_delta', JSON.stringify(delta))
        
        // 只有在线时才广播
        if (wsStatus === 'connected' || navigator.onLine) {
          const payload = JSON.stringify({ 
            ts, 
            clientId: ydoc.clientID,
            delta 
          })
          lwwMap.set('last', payload)
        }
      }, 50)
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
      if (quill) {
        quill.off('text-change', onTextChange as any)
      }
      lwwMap.unobserve(lwwObserver)
      binding.destroy()
      provider.destroy()
      indexeddbProvider.destroy()
      ydoc.destroy()
      
      // Cleanup DOM
      if (editorRef.current) {
        editorRef.current.innerHTML = ''
      }
      
      // Remove toolbar
      const toolbar = document.querySelector('.ql-toolbar')
      if (toolbar) {
        toolbar.remove()
      }
      
      quillRef.current = null
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

          <button 
            onClick={() => { setIsHistoryOpen(true); fetchVersions(); }}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            title="版本历史"
          >
            <History size={20} />
          </button>
          
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

      {/* History Sidebar */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)} />
          <div className="relative w-80 bg-white shadow-2xl h-full flex flex-col border-l animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-lg flex items-center">
                <History className="mr-2" size={20} /> 版本历史
              </h2>
              <button onClick={() => setIsHistoryOpen(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {isLoadingHistory ? (
                <div className="flex justify-center p-8 text-gray-400">加载中...</div>
              ) : versions.length === 0 ? (
                <div className="flex justify-center p-8 text-gray-400">暂无历史版本</div>
              ) : (
                <div className="divide-y">
                  {versions.map((v) => (
                    <div key={v.id} className="p-4 hover:bg-gray-50 transition-colors group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(v.timestamp).toLocaleString()}
                        </span>
                        <button 
                          onClick={() => handleRollback(v.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all flex items-center text-xs"
                          title="回滚到此版本"
                        >
                          <RotateCcw size={14} className="mr-1" /> 回滚
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {v.content || '(空内容)'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 text-[10px] text-gray-400 text-center">
              系统将自动为您保存最近 50 个版本
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
