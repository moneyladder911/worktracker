import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, LogOut, Clock, DollarSign, Calendar, FileDown, Trash2, Edit2, Search, User, MapPin, TrendingUp, TrendingDown, BarChart3, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { format, differenceInMinutes, startOfMonth, endOfMonth, isWithinInterval, parseISO, isToday, isYesterday, isTomorrow, addDays, isBefore, startOfDay, startOfWeek, endOfWeek, subWeeks, subMonths } from 'date-fns'
import { cn } from '@/lib/utils'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const DEFAULT_LOCATIONS = [
  'PadelOne',
  'Matcha Al Quoz',
  'Matcha Creek',
  'Mantra',
  'Padel Pro',
  'Just Padel',
  'WPA (World Padel Academy)',
  'Real Rackets'
]

const TOURNAMENT_PROVIDERS = [
  'ZY',
  'Bati',
  'LPT',
  'UAEPA'
]

// ─── Animated Number Counter ───────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '', prefix = '', decimals = 0 }: { value: number; suffix?: string; prefix?: string; decimals?: number }) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    if (value === 0) { setDisplayed(0); return }
    const duration = 800
    const steps = 30
    const increment = value / steps
    let current = 0
    let step = 0
    const timer = setInterval(() => {
      step++
      current = Math.min(value, increment * step)
      setDisplayed(current)
      if (step >= steps) {
        setDisplayed(value)
        clearInterval(timer)
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [value])

  return (
    <span className="animate-number-tick inline-block">
      {prefix}{decimals > 0 ? displayed.toFixed(decimals) : Math.round(displayed).toLocaleString()}{suffix}
    </span>
  )
}

// ─── Trend Badge ───────────────────────────────────────────────────────────────
function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null
  if (previous === 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-medium text-green-400">
      <TrendingUp className="h-3 w-3" />new
    </span>
  )
  const pct = ((current - previous) / previous) * 100
  const isUp = pct >= 0
  return (
    <span className={cn(
      "flex items-center gap-0.5 text-[10px] font-medium",
      isUp ? "text-green-400" : "text-red-400"
    )}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? '+' : ''}{pct.toFixed(0)}%
    </span>
  )
}

// ─── Skeleton Loader ───────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pt-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="skeleton h-8 w-48 mb-2" />
            <div className="skeleton h-4 w-36" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-9 w-24 rounded-md" />
            <div className="skeleton h-9 w-20 rounded-md" />
          </div>
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-[110px] rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-[280px] rounded-xl" />
        <div className="skeleton h-[200px] rounded-xl" />
        <div className="skeleton h-[400px] rounded-xl" />
      </div>
    </div>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [sessions, setSessions] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('All')
  const [selectedVenue, setSelectedVenue] = useState<string>('All')
  const [selectedClient, setSelectedClient] = useState<string>('All')
  const [selectedStatus, setSelectedStatus] = useState<string>('All')
  const [trackerTab, setTrackerTab] = useState<'club' | 'client'>('club')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeView, setActiveView] = useState<'upcoming' | 'unpaid' | 'all'>('upcoming')
  const [chartMode, setChartMode] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [formMode, setFormMode] = useState<'work' | 'tournament'>('work')
  const [packages, setPackages] = useState<any[]>([])
  const [isAddingPackage, setIsAddingPackage] = useState(false)
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null)
  const [showCompletedPkgs, setShowCompletedPkgs] = useState(false)
  const [newPackage, setNewPackage] = useState({
    client_name: '',
    total_lessons: '5',
    total_amount: '',
    paid_date: format(new Date(), 'yyyy-MM-dd'),
    location: 'PadelOne',
    notes: ''
  })
  const [newSession, setNewSession] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '10:00',
    category: 'Padel lessons',
    paid: 'true',
    location: 'PadelOne',
    notes: '',
    amount: '',
    status: 'completed',
    session_type: 'Private',
    package_id: '' as string
  })

  useEffect(() => {
    fetchSessions()
    fetchPackages()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  function getRelativeDay(dateStr: string) {
    const date = parseISO(dateStr)
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    if (isTomorrow(date)) return 'Tomorrow'
    return null
  }

  // ─── Duration helper (returns hours as decimal, not truncated) ──────────────
  function getDurationHours(s: any): number {
    if (s.category === 'Tournament') return 0
    return differenceInMinutes(new Date(s.end_time), new Date(s.start_time)) / 60
  }

  function formatDuration(s: any): string {
    if (s.category === 'Tournament') return '—'
    const mins = differenceInMinutes(new Date(s.end_time), new Date(s.start_time))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h${m}m`
  }

  async function fetchSessions() {
    try {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) throw error
      setSessions(data || [])
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPackages() {
    try {
      const { data, error } = await supabase
        .from('lesson_packages')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setPackages(data || [])
    } catch {
      // Table might not exist yet
    }
  }

  async function handleAddPackage(e: React.FormEvent) {
    e.preventDefault()
    try {
      const pkgData = {
        client_name: newPackage.client_name,
        total_lessons: parseInt(newPackage.total_lessons),
        total_amount: parseFloat(newPackage.total_amount),
        paid_date: newPackage.paid_date,
        location: newPackage.location,
        notes: newPackage.notes || null
      }
      const { error } = editingPackageId
        ? await supabase.from('lesson_packages').update(pkgData).eq('id', editingPackageId)
        : await supabase.from('lesson_packages').insert(pkgData)
      if (error) throw error
      toast.success(editingPackageId ? 'Package updated' : '📦 Package created!')
      setIsAddingPackage(false)
      setEditingPackageId(null)
      setNewPackage({ client_name: '', total_lessons: '5', total_amount: '', paid_date: format(new Date(), 'yyyy-MM-dd'), location: 'PadelOne', notes: '' })
      fetchPackages()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function deletePackage(id: string) {
    if (!confirm('Delete this package? Linked sessions will be kept but unlinked.')) return
    try {
      const { error } = await supabase.from('lesson_packages').delete().eq('id', id)
      if (error) throw error
      toast.success('Package deleted')
      fetchPackages()
      fetchSessions()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEdit = (session: any) => {
    const isTournament = session.category === 'Tournament'
    setEditingId(session.id)
    setFormMode(isTournament ? 'tournament' : 'work')
    setNewSession({
      date: session.date,
      start_time: isTournament ? '00:00' : format(new Date(session.start_time), 'HH:mm'),
      end_time: isTournament ? '00:00' : format(new Date(session.end_time), 'HH:mm'),
      category: session.category || 'Padel lessons',
      paid: session.paid.toString(),
      location: session.location,
      notes: session.notes || '',
      amount: session.amount?.toString() || '',
      status: session.status,
      session_type: session.session_type || (isTournament ? 'ZY' : 'Private'),
      package_id: session.package_id || ''
    })
    setIsAdding(true)
  }

  async function handleAddSession(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const isTournament = formMode === 'tournament'
      const start = isTournament
        ? new Date(`${newSession.date}T00:00:00`)
        : new Date(`${newSession.date}T${newSession.start_time}:00`)
      const end = isTournament
        ? new Date(`${newSession.date}T00:00:00`)
        : new Date(`${newSession.date}T${newSession.end_time}:00`)

      const hasPackage = !!newSession.package_id
      const sessionData = {
        date: newSession.date,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        category: isTournament ? 'Tournament' : 'Padel lessons',
        paid: hasPackage ? true : newSession.paid === 'true',
        location: newSession.location,
        notes: newSession.notes,
        amount: newSession.amount ? parseFloat(newSession.amount) : null,
        status: isTournament ? 'completed' : newSession.status,
        session_type: newSession.session_type,
        package_id: newSession.package_id || null
      }

      const { error } = editingId
        ? await supabase.from('work_sessions').update(sessionData).eq('id', editingId)
        : await supabase.from('work_sessions').insert(sessionData)

      if (error) throw error

      toast.success(editingId 
        ? (isTournament ? 'Tournament updated' : 'Session updated successfully')
        : (isTournament ? '🏆 Tournament logged!' : 'Session added successfully'))
      setIsAdding(false)
      setEditingId(null)
      setFormMode('work')
      setNewSession({
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '10:00',
        category: 'Padel lessons',
        paid: 'true',
        location: 'PadelOne',
        notes: '',
        amount: '',
        status: 'completed',
        session_type: 'Private',
        package_id: ''
      })
      fetchSessions()
      fetchPackages()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteSession(id: string) {
    if (!confirm('Are you sure you want to delete this session?')) return

    try {
      const { error } = await supabase.from('work_sessions').delete().eq('id', id)
      if (error) throw error
      toast.success('Session deleted')
      fetchSessions()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function togglePaidStatus(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('work_sessions')
        .update({ paid: !currentStatus })
        .eq('id', id)
      if (error) throw error
      toast.success(!currentStatus ? 'Marked as Paid' : 'Marked as Unpaid')
      fetchSessions()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Category', 'Session Type', 'Duration (h)', 'Paid', 'Location', 'Amount', 'Notes', 'Status']
    const csvData = sessions.map(s => [
      s.date,
      s.category,
      s.session_type || 'Other',
      (getDurationHours(s)).toFixed(1),
      s.paid ? 'Yes' : 'No',
      s.location,
      s.amount || '0',
      s.notes || '',
      s.status
    ])

    const csvContent = [headers, ...csvData].map(e => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `work_sessions_${format(new Date(), 'yyyy-MM-dd')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ─── Filtering ──────────────────────────────────────────────────────────────
  const filteredSessions = sessions.filter(s => {
    const monthMatch = selectedMonth === 'All' || format(parseISO(s.date), 'MMMM') === selectedMonth
    const venueMatch = selectedVenue === 'All' || s.location === selectedVenue
    const statusMatch = selectedStatus === 'All' || (selectedStatus === 'Paid' ? s.paid : !s.paid)
    const clientMatch = selectedClient === 'All' || (s.notes || '').trim() === selectedClient
    const searchMatch = searchQuery === '' || 
      (s.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.session_type || '').toLowerCase().includes(searchQuery.toLowerCase())
    return monthMatch && venueMatch && statusMatch && clientMatch && searchMatch
  })

  const today = startOfDay(new Date())
  const upcomingSessions = filteredSessions.filter(s => !isBefore(parseISO(s.date), today))
  const unpaidPastSessions = filteredSessions.filter(s => isBefore(parseISO(s.date), today) && !s.paid)
  const allUnpaidCount = sessions.filter(s => isBefore(parseISO(s.date), today) && !s.paid).length

  const displaySessions = activeView === 'upcoming' 
    ? upcomingSessions 
    : activeView === 'unpaid' 
      ? unpaidPastSessions 
      : filteredSessions

  const groupedSessions = displaySessions.reduce((groups: Record<string, any[]>, session) => {
    const dateKey = session.date
    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey].push(session)
    return groups
  }, {})

  const sortedDateKeys = Object.keys(groupedSessions).sort((a, b) => a.localeCompare(b))

  const totalHours = filteredSessions.reduce((acc, s) => acc + getDurationHours(s), 0)
  const paidEarnings = filteredSessions.filter(s => s.paid).reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0)
  const unpaidEarnings = filteredSessions.filter(s => !s.paid).reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0)

  const months = ['All', ...Array.from(new Set(sessions.map(s => format(parseISO(s.date), 'MMMM'))))]
  
  const existingClients = Array.from(new Set(sessions.map(s => (s.notes || '').trim()).filter(n => n && n !== '-'))).sort()
  
  const venues = ['All', ...Array.from(new Set([
    ...DEFAULT_LOCATIONS,
    ...sessions.map(s => s.location).filter(Boolean)
  ])).sort()]

  const formLocations = Array.from(new Set([
    ...DEFAULT_LOCATIONS,
    ...sessions.map(s => s.location).filter(Boolean)
  ])).sort()

  // ─── Stats Calculations ────────────────────────────────────────────────────
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
  const lastWeekStart = startOfWeek(addDays(new Date(), -7), { weekStartsOn: 1 })
  const lastWeekEnd = endOfWeek(addDays(new Date(), -7), { weekStartsOn: 1 })
  const thisMonthStart = startOfMonth(new Date())
  const thisMonthEnd = endOfMonth(new Date())
  const lastMonthStart = startOfMonth(subMonths(new Date(), 1))
  const lastMonthEnd = endOfMonth(subMonths(new Date(), 1))

  const sessionsInRange = (start: Date, end: Date) =>
    sessions.filter(s => isWithinInterval(parseISO(s.date), { start, end }))

  const hoursInRange = (start: Date, end: Date) =>
    sessionsInRange(start, end).reduce((acc, s) => acc + getDurationHours(s), 0)

  const earningsInRange = (start: Date, end: Date) =>
    sessionsInRange(start, end).reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0)

  const thisWeekHours = hoursInRange(thisWeekStart, thisWeekEnd)
  const lastWeekHours = hoursInRange(lastWeekStart, lastWeekEnd)
  const thisWeekEarnings = earningsInRange(thisWeekStart, thisWeekEnd)
  const lastWeekEarnings = earningsInRange(lastWeekStart, lastWeekEnd)
  const thisMonthEarnings = earningsInRange(thisMonthStart, thisMonthEnd)
  const lastMonthEarnings = earningsInRange(lastMonthStart, lastMonthEnd)

  const totalEarnings = paidEarnings + unpaidEarnings
  const totalSessions = filteredSessions.length
  const avgPerSession = totalSessions > 0 ? totalEarnings / totalSessions : 0

  // ─── Tournament Stats ──────────────────────────────────────────────────────
  const tournamentSessions = filteredSessions.filter(s => s.category === 'Tournament')
  const tournamentEarnings = tournamentSessions.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0)
  const workEarnings = totalEarnings - tournamentEarnings

  // ─── Chart Data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (chartMode === 'daily') {
      const now = new Date()
      const thirtyDaysAgo = addDays(startOfDay(now), -29)
      const days = Array.from({ length: 30 }, (_, i) => addDays(thirtyDaysAgo, i))
      return days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd')
        const daySessions = sessions.filter(s => s.date === dayStr)
        const earnings = daySessions.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
        const hours = daySessions.reduce((sum, s) => sum + getDurationHours(s), 0)
        return {
          key: format(day, 'dd'),
          label: format(day, 'EEE, MMM d'),
          earnings,
          hours: Math.round(hours * 10) / 10,
          sessions: daySessions.length
        }
      })
    }
    if (chartMode === 'weekly') {
      const now = new Date()
      const weeks = Array.from({ length: 12 }, (_, i) => {
        const weekStart = startOfWeek(subWeeks(now, 11 - i), { weekStartsOn: 1 })
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
        return { weekStart, weekEnd }
      })
      return weeks.map(({ weekStart, weekEnd }) => {
        const weekSessions = sessions.filter(s =>
          isWithinInterval(parseISO(s.date), { start: weekStart, end: weekEnd })
        )
        const earnings = weekSessions.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
        const hours = weekSessions.reduce((sum, s) => sum + getDurationHours(s), 0)
        return {
          key: format(weekStart, 'MMM d'),
          label: `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`,
          earnings,
          hours: Math.round(hours * 10) / 10,
          sessions: weekSessions.length
        }
      })
    }
    // monthly
    const now = new Date()
    const monthsList = Array.from({ length: 6 }, (_, i) => {
      const monthStart = startOfMonth(subMonths(now, 5 - i))
      const monthEnd = endOfMonth(monthStart)
      return { monthStart, monthEnd }
    })
    return monthsList.map(({ monthStart, monthEnd }) => {
      const monthSessions = sessions.filter(s =>
        isWithinInterval(parseISO(s.date), { start: monthStart, end: monthEnd })
      )
      const earnings = monthSessions.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
      const hours = monthSessions.reduce((sum, s) => sum + getDurationHours(s), 0)
      return {
        key: format(monthStart, 'MMM'),
        label: format(monthStart, 'MMMM yyyy'),
        earnings,
        hours: Math.round(hours * 10) / 10,
        sessions: monthSessions.length
      }
    })
  }, [sessions, chartMode])

  const chartTotal = chartData.reduce((sum, d) => sum + d.earnings, 0)
  const bestPeriod = chartData.reduce((best, d) => d.earnings > best.earnings ? d : best, chartData[0] || { label: '-', earnings: 0 })
  const avgPeriod = chartData.length > 0 ? chartTotal / chartData.filter(d => d.earnings > 0).length || 0 : 0

  // ─── Show loading skeleton ──────────────────────────────────────────────────
  if (loading && sessions.length === 0) {
    return <DashboardSkeleton />
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pt-[env(safe-area-inset-top,16px)]" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 48px)' }}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Work Tracker
              </h1>
              <p className="text-muted-foreground flex items-center gap-2 text-xs md:text-sm mt-0.5">
                <Clock className="h-3.5 w-3.5" />
                {format(currentTime, 'EEEE, MMM dd · HH:mm:ss')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportToCSV} variant="outline" size="sm" className="glass-card hover:bg-accent border-border hidden md:flex">
                <FileDown className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Button onClick={exportToCSV} variant="outline" size="icon" className="glass-card hover:bg-accent border-border md:hidden h-8 w-8">
                <FileDown className="h-4 w-4" />
              </Button>
              <Button onClick={() => supabase.auth.signOut()} variant="outline" size="icon" className="glass-card hover:bg-accent border-border h-8 w-8 md:hidden">
                <LogOut className="h-4 w-4" />
              </Button>
              <Button onClick={() => supabase.auth.signOut()} variant="outline" size="sm" className="glass-card hover:bg-accent border-border hidden md:flex">
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </div>
          </div>
        </header>

        {/* ─── 6 Premium Stat Cards ────────────────────────────────────────── */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {/* This Week Hours */}
          <Card className="glass-card glass-card-glow-blue animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] uppercase tracking-wider font-medium text-blue-400/80">This Week</CardTitle>
              <div className="icon-bg-blue rounded-md p-1.5">
                <Calendar className="h-3 w-3 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-2xl font-bold text-white">
                <AnimatedNumber value={Math.round(thisWeekHours)} suffix="h" />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[9px] text-muted-foreground">{format(thisWeekStart, 'MMM d')} – {format(thisWeekEnd, 'MMM d')}</p>
                <TrendBadge current={thisWeekHours} previous={lastWeekHours} />
              </div>
            </CardContent>
          </Card>

          {/* This Week Earnings */}
          <Card className="glass-card glass-card-glow-green animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] uppercase tracking-wider font-medium text-green-400/80">Week Earnings</CardTitle>
              <div className="icon-bg-green rounded-md p-1.5">
                <DollarSign className="h-3 w-3 text-green-400" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-2xl font-bold text-white">
                <AnimatedNumber value={Math.round(thisWeekEarnings)} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[9px] text-muted-foreground">AED</p>
                <TrendBadge current={thisWeekEarnings} previous={lastWeekEarnings} />
              </div>
            </CardContent>
          </Card>

          {/* This Month Earnings */}
          <Card className="glass-card glass-card-glow-purple animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] uppercase tracking-wider font-medium text-purple-400/80">Month Earnings</CardTitle>
              <div className="icon-bg-purple rounded-md p-1.5">
                <BarChart3 className="h-3 w-3 text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-2xl font-bold text-white">
                <AnimatedNumber value={Math.round(thisMonthEarnings)} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[9px] text-muted-foreground">{format(new Date(), 'MMMM')}</p>
                <TrendBadge current={thisMonthEarnings} previous={lastMonthEarnings} />
              </div>
            </CardContent>
          </Card>

          {/* Total Earnings */}
          <Card className="glass-card glass-card-glow-emerald animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] uppercase tracking-wider font-medium text-emerald-400/80">Total Earned</CardTitle>
              <div className="icon-bg-emerald rounded-md p-1.5">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-xl font-bold text-white">
                <AnimatedNumber value={Math.round(totalEarnings)} />
              </div>
              <div className="flex flex-col mt-0.5">
                <span className="text-[9px] text-green-400 font-medium">✓ {paidEarnings.toLocaleString()} AED</span>
                {unpaidEarnings > 0 && <span className="text-[9px] text-yellow-400 font-medium">⏳ {unpaidEarnings.toLocaleString()} AED</span>}
              </div>
            </CardContent>
          </Card>

          {/* Total Hours */}
          <Card className="glass-card glass-card-glow-slate animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] uppercase tracking-wider font-medium text-slate-400/80">Total Hours</CardTitle>
              <div className="icon-bg-slate rounded-md p-1.5">
                <Clock className="h-3 w-3 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-2xl font-bold text-white">
                <AnimatedNumber value={Math.round(totalHours)} suffix="h" />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          {/* Tournaments */}
          <Card className="glass-card glass-card-glow-amber animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] uppercase tracking-wider font-medium text-amber-400/80">Tournaments</CardTitle>
              <div className="icon-bg-amber rounded-md p-1.5">
                <Trophy className="h-3 w-3 text-amber-400" />
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="text-2xl font-bold text-white">
                <AnimatedNumber value={Math.round(tournamentEarnings)} />
              </div>
              <div className="flex flex-col mt-0.5">
                <span className="text-[9px] text-amber-400 font-medium">🏆 {tournamentSessions.length} tournament{tournamentSessions.length !== 1 ? 's' : ''}</span>
                <span className="text-[9px] text-muted-foreground">AED prize money</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Lesson Packages ──────────────────────────────────────────────── */}
        {(packages.length > 0 || isAddingPackage) && (
          <Card className="glass-card animate-fade-in-up" style={{ animationDelay: '0.12s' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
              <div>
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">📦 Lesson Packages</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Prepaid bundles — track progress per client</p>
              </div>
              <Button size="sm" onClick={() => setIsAddingPackage(true)} className="bg-blue-500 hover:bg-blue-600 text-white text-xs">
                <Plus className="mr-1 h-3 w-3" /> New
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {isAddingPackage && (
                <form onSubmit={handleAddPackage} className="p-3 rounded-xl bg-accent/20 border border-border/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    <div className="space-y-1 col-span-2 md:col-span-1">
                      <Label className="text-xs">Client Name</Label>
                      <Input placeholder="e.g. Ahmed" value={newPackage.client_name} onChange={e => setNewPackage({ ...newPackage, client_name: e.target.value })} required className="bg-accent/50 h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lessons</Label>
                      <Input type="number" min="1" value={newPackage.total_lessons} onChange={e => setNewPackage({ ...newPackage, total_lessons: e.target.value })} required className="bg-accent/50 h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Total Paid (AED)</Label>
                      <Input type="number" placeholder="2000" value={newPackage.total_amount} onChange={e => setNewPackage({ ...newPackage, total_amount: e.target.value })} required className="bg-accent/50 h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Paid Date</Label>
                      <Input type="date" value={newPackage.paid_date} onChange={e => setNewPackage({ ...newPackage, paid_date: e.target.value })} required className="bg-accent/50 h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Location</Label>
                      <Select value={newPackage.location} onValueChange={v => setNewPackage({ ...newPackage, location: v })}>
                        <SelectTrigger className="bg-accent/50 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{formLocations.map(loc => (<SelectItem key={loc} value={loc}>📍 {loc}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input placeholder="optional" value={newPackage.notes} onChange={e => setNewPackage({ ...newPackage, notes: e.target.value })} className="bg-accent/50 h-9 text-sm" />
                    </div>
                  </div>
                  {parseInt(newPackage.total_lessons) > 0 && parseFloat(newPackage.total_amount) > 0 && (
                    <p className="text-xs text-muted-foreground">→ {(parseFloat(newPackage.total_amount) / parseInt(newPackage.total_lessons)).toFixed(0)} AED per lesson</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setIsAddingPackage(false); setEditingPackageId(null) }}>Cancel</Button>
                    <Button type="submit" size="sm" className="bg-blue-500 hover:bg-blue-600 text-white">{editingPackageId ? 'Update' : 'Create Package'}</Button>
                  </div>
                </form>
              )}
              {(() => {
                const activePkgs = packages.filter(pkg => sessions.filter(s => s.package_id === pkg.id).length < pkg.total_lessons)
                const donePkgs = packages.filter(pkg => sessions.filter(s => s.package_id === pkg.id).length >= pkg.total_lessons)
                return (
                  <>
                    {activePkgs.map(pkg => {
                      const done = sessions.filter(s => s.package_id === pkg.id).length
                      const pct = (done / pkg.total_lessons) * 100
                      const perLesson = pkg.total_amount / pkg.total_lessons
                      return (
                        <div key={pkg.id} className="p-3 rounded-xl bg-accent/15 border border-border/50 hover:border-blue-500/30 transition-all group">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-white text-sm">👤 {pkg.client_name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">{done}/{pkg.total_lessons} lessons</span>
                            </div>
                            <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => {
                                setFormMode('work')
                                setNewSession(s => ({ ...s, notes: pkg.client_name, location: pkg.location || 'PadelOne', amount: perLesson.toString(), paid: 'true', package_id: pkg.id }))
                                setIsAdding(true)
                              }}><Plus className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deletePackage(pkg.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2 flex-wrap">
                            <span>📍 {pkg.location}</span>
                            <span className="text-green-400 font-medium">{pkg.total_amount.toLocaleString()} AED</span>
                            <span>→ {perLesson.toFixed(0)} AED/lesson</span>
                            {pkg.notes && <span>· {pkg.notes}</span>}
                          </div>
                          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
                          </div>
                        </div>
                      )
                    })}
                    {donePkgs.length > 0 && (
                      <div>
                        <button onClick={() => setShowCompletedPkgs(!showCompletedPkgs)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-1">
                          {showCompletedPkgs ? '▼' : '▶'} {donePkgs.length} completed
                        </button>
                        {showCompletedPkgs && donePkgs.map(pkg => (
                          <div key={pkg.id} className="p-2.5 rounded-xl bg-accent/10 border border-border/30 opacity-60 mt-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-white">✅ {pkg.client_name} — {pkg.total_lessons}/{pkg.total_lessons}</span>
                              <span className="text-[11px] text-muted-foreground">{pkg.total_amount.toLocaleString()} AED · {(pkg.total_amount / pkg.total_lessons).toFixed(0)}/lesson</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* ─── Earnings Chart ──────────────────────────────────────────────── */}
        <Card className="glass-card animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-2 pt-4 px-4 gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-white">Earnings Overview</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {chartMode === 'daily' ? 'Last 30 days' : chartMode === 'weekly' ? 'Last 12 weeks' : 'Last 6 months'} · <span className="text-green-400 font-medium">{chartTotal.toLocaleString()} AED</span>
              </p>
            </div>
            <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg">
              {(['daily', 'weekly', 'monthly'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setChartMode(mode)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-medium rounded-md transition-all",
                    chartMode === mode 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <div className="h-[200px] md:h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'daily' ? (
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis 
                      dataKey="key" 
                      tick={{ fill: '#6b7280', fontSize: 9 }} 
                      axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis 
                      tick={{ fill: '#6b7280', fontSize: 10 }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(222 47% 8% / 0.95)', 
                        border: '1px solid hsl(220 20% 18%)', 
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: 'white',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                      }}
                      labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.label || ''}
                      formatter={(value: number, name: string) => [
                        name === 'earnings' ? `${value.toLocaleString()} AED` : `${value}`,
                        name === 'earnings' ? 'Earnings' : name === 'hours' ? 'Hours' : 'Sessions'
                      ]}
                      labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="earnings" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      fill="url(#earningsGradient)"
                      dot={(props: any) => {
                        if (props.payload.earnings > 0) {
                          return <circle cx={props.cx} cy={props.cy} r={3} fill="#22c55e" stroke="none" />
                        }
                        return <circle cx={0} cy={0} r={0} />
                      }}
                      activeDot={{ r: 5, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartMode === 'weekly' ? '#22c55e' : '#8b5cf6'} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={chartMode === 'weekly' ? '#22c55e' : '#8b5cf6'} stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis 
                      dataKey="key" 
                      tick={{ fill: '#6b7280', fontSize: 9 }} 
                      axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#6b7280', fontSize: 10 }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(222 47% 8% / 0.95)', 
                        border: '1px solid hsl(220 20% 18%)', 
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: 'white',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                      }}
                      labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.label || ''}
                      formatter={(value: number, name: string) => [
                        name === 'earnings' ? `${value.toLocaleString()} AED` : `${value}`,
                        name === 'earnings' ? 'Earnings' : 'Hours'
                      ]}
                      labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                    />
                    <Bar 
                      dataKey="earnings" 
                      fill="url(#barGradient)" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            {/* Chart summary */}
            <div className="flex items-center justify-center gap-4 mt-2 px-3 pb-1">
              <span className="text-[10px] text-muted-foreground">
                Best: <span className="text-white font-medium">{bestPeriod?.label}</span> ({bestPeriod?.earnings?.toLocaleString()} AED)
              </span>
              <span className="text-[10px] text-muted-foreground">
                Avg: <span className="text-white font-medium">{Math.round(avgPeriod).toLocaleString()} AED</span>/{chartMode === 'daily' ? 'day' : chartMode === 'weekly' ? 'week' : 'month'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ─── Club & Client Tracker ───────────────────────────────────────── */}
        <Card className="glass-card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg">
              <button
                onClick={() => setTrackerTab('club')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                  trackerTab === 'club' 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <MapPin className="h-3 w-3" /> Venues
              </button>
              <button
                onClick={() => setTrackerTab('client')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                  trackerTab === 'client' 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <User className="h-3 w-3" /> Clients
              </button>
            </div>
            {trackerTab === 'club' ? (
              <MapPin className="h-4 w-4 text-muted-foreground" />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {trackerTab === 'club' ? (
              (() => {
                const clubMap: Record<string, { 
                  hours: number; sessions: number; paid: number; unpaid: number; paidAmount: number; unpaidAmount: number;
                  groups: Record<string, { sessions: number; hours: number }> 
                }> = {}
                filteredSessions.forEach(s => {
                  const club = s.location || 'Other'
                  if (!clubMap[club]) clubMap[club] = { hours: 0, sessions: 0, paid: 0, unpaid: 0, paidAmount: 0, unpaidAmount: 0, groups: {} }
                  const hours = getDurationHours(s)
                  clubMap[club].hours += hours
                  clubMap[club].sessions += 1
                  if (s.paid) { clubMap[club].paid += 1; clubMap[club].paidAmount += (parseFloat(s.amount) || 0) }
                  else { clubMap[club].unpaid += 1; clubMap[club].unpaidAmount += (parseFloat(s.amount) || 0) }
                  const name = (s.notes || '').trim()
                  if (name && name !== '-') {
                    const groupKey = name.split(/[/,]/).map((c: string) => c.trim()).filter(Boolean).join(' & ')
                    if (!clubMap[club].groups[groupKey]) clubMap[club].groups[groupKey] = { sessions: 0, hours: 0 }
                    clubMap[club].groups[groupKey].sessions += 1
                    clubMap[club].groups[groupKey].hours += hours
                  }
                })
                const clubEntries = Object.entries(clubMap).sort((a, b) => (b[1].paidAmount + b[1].unpaidAmount) - (a[1].paidAmount + a[1].unpaidAmount))
                const maxEarnings = Math.max(...clubEntries.map(([, s]) => s.paidAmount + s.unpaidAmount), 1)
                if (clubEntries.length === 0) return <p className="text-sm text-muted-foreground">No data yet. Log sessions to see venue stats.</p>
                return (
                  <div className="space-y-2">
                    {clubEntries.map(([clubName, stats]) => {
                      const totalAmt = stats.paidAmount + stats.unpaidAmount
                      const pct = (totalAmt / maxEarnings) * 100
                      const isSelected = selectedVenue === clubName
                      return (
                        <button
                          key={clubName}
                          onClick={() => setSelectedVenue(isSelected ? 'All' : clubName)}
                          className={cn(
                            "w-full p-3 rounded-xl text-left transition-all border group",
                            isSelected 
                              ? "glass-card glass-card-glow-green border-green-500/30" 
                              : "bg-accent/15 hover:bg-accent/30 border-transparent hover:border-border"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold text-white text-sm md:text-base flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {clubName}
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                              {stats.paidAmount > 0 && <span className="text-[10px] md:text-xs text-green-400 font-medium">{stats.paidAmount.toLocaleString()} AED paid</span>}
                              {stats.unpaidAmount > 0 && <span className="text-[10px] md:text-xs text-yellow-400 font-medium">⏳ {stats.unpaidAmount.toLocaleString()} AED</span>}
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground mb-2">
                            {stats.sessions} session{stats.sessions > 1 ? 's' : ''} · {Math.round(stats.hours)}h total
                          </div>
                          {/* Progress bar */}
                          <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ 
                                width: `${pct}%`,
                                background: 'linear-gradient(90deg, #22c55e, #10b981)'
                              }}
                            />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })()
            ) : (
              (() => {
                const clientMap: Record<string, { 
                  hours: number; sessions: number; paid: number; unpaid: number; paidAmount: number; unpaidAmount: number;
                  venues: Record<string, { sessions: number; hours: number }> 
                }> = {}
                filteredSessions.forEach(s => {
                  const client = (s.notes || '').trim() || 'Other'
                  if (!clientMap[client]) clientMap[client] = { hours: 0, sessions: 0, paid: 0, unpaid: 0, paidAmount: 0, unpaidAmount: 0, venues: {} }
                  const hours = getDurationHours(s)
                  clientMap[client].hours += hours
                  clientMap[client].sessions += 1
                  if (s.paid) { clientMap[client].paid += 1; clientMap[client].paidAmount += (parseFloat(s.amount) || 0) }
                  else { clientMap[client].unpaid += 1; clientMap[client].unpaidAmount += (parseFloat(s.amount) || 0) }
                  
                  const venue = s.location || 'Other'
                  if (!clientMap[client].venues[venue]) clientMap[client].venues[venue] = { sessions: 0, hours: 0 }
                  clientMap[client].venues[venue].sessions += 1
                  clientMap[client].venues[venue].hours += hours
                })
                const clientEntries = Object.entries(clientMap).sort((a, b) => (b[1].paidAmount + b[1].unpaidAmount) - (a[1].paidAmount + a[1].unpaidAmount))
                const maxEarnings = Math.max(...clientEntries.map(([, s]) => s.paidAmount + s.unpaidAmount), 1)
                if (clientEntries.length === 0) return <p className="text-sm text-muted-foreground">No data yet. Log sessions to see client stats.</p>
                return (
                  <div className="space-y-2">
                    {clientEntries.map(([clientName, stats]) => {
                      const venueList = Object.entries(stats.venues).sort((a, b) => b[1].hours - a[1].hours)
                      const totalAmt = stats.paidAmount + stats.unpaidAmount
                      const pct = (totalAmt / maxEarnings) * 100
                      const isSelected = selectedClient === clientName
                      return (
                        <button
                          key={clientName}
                          onClick={() => setSelectedClient(isSelected ? 'All' : clientName)}
                          className={cn(
                            "w-full p-3 rounded-xl text-left transition-all border group",
                            isSelected 
                              ? "glass-card glass-card-glow-blue border-blue-500/30" 
                              : "bg-accent/15 hover:bg-accent/30 border-transparent hover:border-border"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold text-white text-sm md:text-base flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground" /> {clientName}
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                              {stats.paidAmount > 0 && <span className="text-[10px] md:text-xs text-green-400 font-medium">{stats.paidAmount.toLocaleString()} AED paid</span>}
                              {stats.unpaidAmount > 0 && <span className="text-[10px] md:text-xs text-yellow-400 font-medium">⏳ {stats.unpaidAmount.toLocaleString()} AED</span>}
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground mb-2">
                            {stats.sessions} session{stats.sessions > 1 ? 's' : ''} · {Math.round(stats.hours)}h total
                          </div>
                          {/* Progress bar */}
                          <div className="h-1 bg-muted/50 rounded-full overflow-hidden mb-2">
                            <div 
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ 
                                width: `${pct}%`,
                                background: 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                              }}
                            />
                          </div>
                          {venueList.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {venueList.map(([venueName, vStats]: [string, { sessions: number; hours: number }]) => (
                                <span key={venueName} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/50">
                                  📍 {venueName} ({Math.round(vStats.hours)}h)
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })()
            )}
          </CardContent>
        </Card>

        {/* ─── Sessions Header + Filters ───────────────────────────────────── */}
        <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold text-white">Sessions</h2>
            <Button onClick={() => setIsAdding(true)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow-green">
              <Plus className="mr-1 h-4 w-4" /> Log
            </Button>
          </div>
          {/* View Tabs */}
          <div className="flex gap-1 bg-muted/40 p-1 rounded-xl">
            <button
              onClick={() => setActiveView('upcoming')}
              className={cn(
                'flex-1 px-3 py-2 text-xs md:text-sm font-medium rounded-lg transition-all',
                activeView === 'upcoming' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              📅 Upcoming ({upcomingSessions.length})
            </button>
            <button
              onClick={() => setActiveView('unpaid')}
              className={cn(
                'flex-1 px-3 py-2 text-xs md:text-sm font-medium rounded-lg transition-all',
                activeView === 'unpaid' ? 'bg-yellow-500/90 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              💸 Unpaid ({allUnpaidCount})
            </button>
            <button
              onClick={() => setActiveView('all')}
              className={cn(
                'flex-1 px-3 py-2 text-xs md:text-sm font-medium rounded-lg transition-all',
                activeView === 'all' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              📋 All ({filteredSessions.length})
            </button>
          </div>
          <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2">
            <div className="relative col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search client or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full md:w-[200px] glass-card border-border"
              />
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="glass-card border-border">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedVenue} onValueChange={setSelectedVenue}>
              <SelectTrigger className="glass-card border-border">
                <SelectValue placeholder="Venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="glass-card border-border md:w-[150px]">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Clients</SelectItem>
                {existingClients.map(c => (
                  <SelectItem key={c} value={c}>👤 {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="col-span-2 md:w-[120px] glass-card border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            
            {(selectedMonth !== 'All' || selectedVenue !== 'All' || selectedClient !== 'All' || selectedStatus !== 'All' || searchQuery !== '') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSelectedMonth('All')
                  setSelectedVenue('All')
                  setSelectedClient('All')
                  setSelectedStatus('All')
                  setSearchQuery('')
                }}
                className="text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 col-span-2 md:col-span-1 h-9"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>

        {/* ─── Add/Edit Session Form ───────────────────────────────────────── */}
        {isAdding && (
          <Card className="glass-card border-primary/30 animate-in fade-in slide-in-from-top-4 duration-300">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">
                    {editingId 
                      ? (formMode === 'tournament' ? 'Edit Tournament' : 'Edit Session') 
                      : (formMode === 'tournament' ? '🏆 Log Tournament Result' : 'Log New Work Session')}
                  </CardTitle>
                  <CardDescription>
                    {formMode === 'tournament' 
                      ? 'Record your tournament result and prize money.' 
                      : 'Enter the details of your work session below.'}
                  </CardDescription>
                </div>
                {/* Work / Tournament Toggle */}
                <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setFormMode('work')
                      setNewSession(s => ({ ...s, session_type: 'Private' }))
                    }}
                    className={cn(
                      "px-3 py-1.5 text-[11px] font-medium rounded-md transition-all flex items-center gap-1",
                      formMode === 'work' 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    📋 Work
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormMode('tournament')
                      setNewSession(s => ({ ...s, session_type: 'ZY', status: 'completed' }))
                    }}
                    className={cn(
                      "px-3 py-1.5 text-[11px] font-medium rounded-md transition-all flex items-center gap-1",
                      formMode === 'tournament' 
                        ? "bg-amber-500 text-white shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    🏆 Tournament
                  </button>
                </div>
              </div>
            </CardHeader>
            <form onSubmit={handleAddSession}>
              <CardContent className="grid gap-6 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={newSession.date} onChange={e => setNewSession({ ...newSession, date: e.target.value })} required className="bg-accent/50" />
                </div>

                {/* Start/End Time — only for work sessions */}
                {formMode === 'work' && (
                  <>
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input type="time" value={newSession.start_time} onChange={e => setNewSession({ ...newSession, start_time: e.target.value })} required className="bg-accent/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input type="time" value={newSession.end_time} onChange={e => setNewSession({ ...newSession, end_time: e.target.value })} required className="bg-accent/50" />
                    </div>
                  </>
                )}

                {/* Tournament Provider — only for tournaments */}
                {formMode === 'tournament' && (
                  <div className="space-y-2">
                    <Label>Tournament</Label>
                    <Select value={newSession.session_type} onValueChange={v => setNewSession({ ...newSession, session_type: v })}>
                      <SelectTrigger className="bg-accent/50">
                        <SelectValue placeholder="Select tournament..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TOURNAMENT_PROVIDERS.map(t => (
                          <SelectItem key={t} value={t}>🏆 {t}</SelectItem>
                        ))}
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{formMode === 'tournament' ? 'Prize Received?' : 'Paid Status'}</Label>
                  <Select value={newSession.paid} onValueChange={v => setNewSession({ ...newSession, paid: v })}>
                    <SelectTrigger className="bg-accent/50">
                      <SelectValue placeholder="Paid or Unpaid?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">{formMode === 'tournament' ? 'Yes — Received' : 'Paid'}</SelectItem>
                      <SelectItem value="false">{formMode === 'tournament' ? 'Not yet' : 'Unpaid'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Session Type — only for work */}
                {formMode === 'work' && (
                  <div className="space-y-2">
                    <Label>Session Type</Label>
                    <Select value={newSession.session_type} onValueChange={v => setNewSession({ ...newSession, session_type: v })}>
                      <SelectTrigger className="bg-accent/50">
                        <SelectValue placeholder="Session Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Private">Private</SelectItem>
                        <SelectItem value="Semi-private">Semi-private</SelectItem>
                        <SelectItem value="Trio">Trio</SelectItem>
                        <SelectItem value="Group">Group</SelectItem>
                        <SelectItem value="Project Work">Project Work</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Work Status — only for work */}
                {formMode === 'work' && (
                  <div className="space-y-2">
                    <Label>Work Status</Label>
                    <Select value={newSession.status} onValueChange={v => setNewSession({ ...newSession, status: v })}>
                      <SelectTrigger className="bg-accent/50">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{formMode === 'tournament' ? 'Prize Money (AED)' : 'Amount (Optional)'}</Label>
                  <Input type="number" placeholder="0.00" value={newSession.amount} onChange={e => setNewSession({ ...newSession, amount: e.target.value })} className="bg-accent/50" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{formMode === 'tournament' ? 'Venue / Location' : 'Location'}</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={formLocations.includes(newSession.location) ? newSession.location : (newSession.location === '' ? '' : '__custom__')} 
                      onValueChange={v => {
                        if (v === '__custom__') {
                          setNewSession({ ...newSession, location: '' })
                        } else {
                          setNewSession({ ...newSession, location: v })
                        }
                      }}
                    >
                      <SelectTrigger className="bg-accent/50 flex-1">
                        <SelectValue placeholder="Select venue..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__custom__">+ Add Custom Venue</SelectItem>
                        {formLocations.map(loc => (
                          <SelectItem key={loc} value={loc}>📍 {loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {(!formLocations.includes(newSession.location) || newSession.location === '') && (
                      <Input 
                        placeholder="Enter venue name" 
                        value={newSession.location} 
                        onChange={e => setNewSession({ ...newSession, location: e.target.value })} 
                        className="bg-accent/50 flex-1 animate-in fade-in"
                        required
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{formMode === 'tournament' ? 'Partner / Notes' : 'Client / Group Name'}</Label>
                  <div className="flex gap-2">
                    {formMode === 'work' ? (
                      <>
                        <Select 
                          value={existingClients.includes(newSession.notes) ? newSession.notes : (newSession.notes === '' ? '' : '__custom__')} 
                          onValueChange={v => {
                            if (v === '__custom__') {
                              setNewSession({ ...newSession, notes: '' })
                            } else {
                              setNewSession({ ...newSession, notes: v })
                            }
                          }}
                        >
                          <SelectTrigger className="bg-accent/50 flex-1">
                            <SelectValue placeholder="Select client..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__custom__">+ Add Custom Name</SelectItem>
                            {existingClients.map(c => (
                              <SelectItem key={c} value={c}>👤 {c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(!existingClients.includes(newSession.notes) || newSession.notes === '') && (
                          <Input 
                            placeholder="Enter client name" 
                            value={newSession.notes} 
                            onChange={e => setNewSession({ ...newSession, notes: e.target.value })} 
                            className="bg-accent/50 flex-1 animate-in fade-in"
                            required
                          />
                        )}
                      </>
                    ) : (
                      <Input 
                        placeholder="e.g. Partner name, tournament details..." 
                        value={newSession.notes} 
                        onChange={e => setNewSession({ ...newSession, notes: e.target.value })} 
                        className="bg-accent/50 flex-1"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => { setIsAdding(false); setEditingId(null); setFormMode('work'); }}>Cancel</Button>
                <Button type="submit" disabled={loading} className={formMode === 'tournament' ? "shadow-glow-amber bg-amber-500 hover:bg-amber-600 text-white" : "shadow-glow-green"}>
                  {editingId 
                    ? (formMode === 'tournament' ? 'Update Tournament' : 'Update Session') 
                    : (formMode === 'tournament' ? '🏆 Save Tournament' : 'Save Session')}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* ─── Sessions List ───────────────────────────────────────────────── */}
        {displaySessions.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <div className="text-4xl mb-3">
                {activeView === 'upcoming' ? '📅' : activeView === 'unpaid' ? '🎉' : '🔍'}
              </div>
              <p className="text-muted-foreground text-sm">
                {activeView === 'upcoming' ? 'No upcoming sessions. Tap "Log" to add one!' 
                  : activeView === 'unpaid' ? 'No unpaid sessions — you\'re all caught up!'
                  : 'No sessions found. Try adjusting your filters.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedDateKeys.map((dateKey) => {
              const dateSessions = groupedSessions[dateKey]
              const workSessionsInDay = dateSessions.filter((s: any) => s.category !== 'Tournament')
              const tournamentsInDay = dateSessions.filter((s: any) => s.category === 'Tournament')
              const dayHours = workSessionsInDay.reduce((acc: number, s: any) => acc + getDurationHours(s), 0)
              const dayEarnings = dateSessions.reduce((acc: number, s: any) => acc + (parseFloat(s.amount) || 0), 0)
              const isTodayDate = isToday(parseISO(dateKey))
              return (
                <Card key={dateKey} className={cn(
                  "overflow-hidden glass-card",
                  isTodayDate 
                    ? "today-pulse border-primary/40 border-l-4 border-l-primary" 
                    : ""
                )}>
                  <div className={cn(
                    "flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 border-b border-border/50",
                    isTodayDate 
                      ? "bg-gradient-to-r from-primary/10 to-transparent" 
                      : "bg-gradient-to-r from-muted/40 to-transparent"
                  )}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Calendar className={cn("h-4 w-4 hidden md:block", isTodayDate ? "text-primary" : "text-muted-foreground")} />
                      <span className="font-semibold text-white text-sm md:text-base">{format(parseISO(dateKey), 'EEE, MMM dd')}</span>
                      {getRelativeDay(dateKey) && (
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-medium",
                          getRelativeDay(dateKey) === 'Today' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                        )}>
                          {getRelativeDay(dateKey)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {dayEarnings > 0 && (
                        <span className="text-[10px] md:text-xs text-green-400 font-medium">{dayEarnings.toLocaleString()} AED</span>
                      )}
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        {workSessionsInDay.length > 0 && <>{workSessionsInDay.length}× · {Math.round(dayHours * 10) / 10}h</>}
                        {tournamentsInDay.length > 0 && <>{workSessionsInDay.length > 0 ? ' · ' : ''}🏆 {tournamentsInDay.length}</>}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-border/30">
                    {dateSessions.map((session: any) => (
                      <div 
                        key={session.id} 
                        className={cn(
                          "px-3 md:px-4 py-3 hover:bg-accent/20 transition-colors border-l-2",
                          session.category === 'Tournament' 
                            ? "border-l-amber-500/70" 
                            : session.paid ? "border-l-green-500/50" : "border-l-yellow-500/50"
                        )}
                      >
                        {/* Desktop row */}
                        <div className="hidden md:flex items-center justify-between">
                          <div className="flex items-center gap-6 flex-1 min-w-0">
                            <div className="w-[100px] shrink-0">
                              {session.category === 'Tournament' ? (
                                <>
                                  <span className="font-medium text-amber-400 flex items-center gap-1">🏆 {session.session_type}</span>
                                  <div className="text-[11px] text-muted-foreground">Tournament</div>
                                </>
                              ) : (
                                <>
                                  <span className="font-medium text-white">
                                    {format(new Date(session.start_time), 'HH:mm')} - {format(new Date(session.end_time), 'HH:mm')}
                                  </span>
                                  <div className="text-[11px] text-muted-foreground">{formatDuration(session)}</div>
                                </>
                              )}
                            </div>
                            <div className="w-[90px] shrink-0 text-muted-foreground text-sm">
                              {session.category === 'Tournament' ? 'Prize' : (session.session_type || 'Other')}
                            </div>
                            <div className="w-[120px] shrink-0 text-muted-foreground text-sm">{session.location}</div>
                            <button
                              onClick={() => togglePaidStatus(session.id, session.paid)}
                              className={cn(
                                "flex items-center gap-1.5 hover:opacity-80 transition-opacity w-[70px] shrink-0 text-sm",
                                session.paid ? "text-green-400" : "text-yellow-400"
                              )}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", session.paid ? "bg-green-400" : "bg-yellow-400")} />
                              {session.paid ? 'Paid' : 'Unpaid'}
                            </button>
                            <div className="w-[80px] shrink-0 text-sm font-medium">{session.amount ? `${session.amount} AED` : '-'}</div>
                            <div className="text-muted-foreground truncate text-sm">{session.notes || '-'}</div>
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(session)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteSession(session.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {/* Mobile card */}
                        <div className="md:hidden">
                          <div className="flex items-center gap-2 mb-1">
                            {session.category === 'Tournament' ? (
                              <span className="font-semibold text-amber-400">🏆 {session.session_type} Tournament</span>
                            ) : (
                              <>
                                <span className="font-semibold text-white">
                                  {format(new Date(session.start_time), 'HH:mm')} - {format(new Date(session.end_time), 'HH:mm')}
                                </span>
                                <span className="text-[11px] text-muted-foreground">({formatDuration(session)})</span>
                              </>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2">
                            {session.category !== 'Tournament' && <span className="text-muted-foreground">{session.session_type || 'Other'}</span>}
                            <span className="text-muted-foreground">📍 {session.location}</span>
                            {session.notes && session.notes !== '-' && <span className="text-muted-foreground">👤 {session.notes}</span>}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => togglePaidStatus(session.id, session.paid)}
                                className={cn(
                                  "flex items-center gap-1.5 text-xs font-medium",
                                  session.paid ? "text-green-400" : "text-yellow-400"
                                )}>
                                <span className={cn("h-1.5 w-1.5 rounded-full", session.paid ? "bg-green-400" : "bg-yellow-400")} />
                                {session.paid ? 'Paid' : 'Unpaid'}
                              </button>
                              {session.amount && <span className="text-xs font-medium">{session.amount} AED</span>}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(session)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteSession(session.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
