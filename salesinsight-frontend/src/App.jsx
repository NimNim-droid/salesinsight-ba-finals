import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Activity, Boxes, Users, PhilippinePeso, ShoppingBag,
  AlertTriangle, RefreshCw, TrendingUp, Menu, X,
  ChartNoAxesCombined, Package, CheckCircle2,
  Filter, PlusCircle, ArrowRight,
} from 'lucide-react'
import './App.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const formatMoneyShort = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']

const PRESET_CATEGORIES = [
  'Keyboards',
  'Chargers',
  'Audio',
  'Phone Cases',
  'Accessories',
]

function StatCard({ title, value, subtitle, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon"><Icon size={20} /></span>
      </div>
      <h2>{value}</h2>
      <p>{subtitle}</p>
    </div>
  )
}

function Panel({ title, subtitle, children, className = '', id }) {
  return (
    <section id={id} className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function getApiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
}

async function fetchWithRetry(url, onStatusChange) {
  const maxAttempts = 4

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)

    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) {
        const err = new Error(`Server returned ${response.status}`)
        err.retryable = response.status >= 500
        throw err
      }
      return await response.json()
    } catch (err) {
      const isTimeout = err.name === 'AbortError'
      const isRetryable = isTimeout || err.retryable || err instanceof TypeError

      if (attempt < maxAttempts && isRetryable) {
        onStatusChange?.(`Waking up the server (attempt ${attempt + 1}/${maxAttempts})... Please wait.`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
        continue
      }

      if (isTimeout) {
        throw new Error('Server request timed out while waking up', { cause: err })
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export default function App() {
  const [activePage, setActivePage] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)

  // Analytics data
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Loading your business data...')
  const requestCounterRef = useRef(0)

  // Management data (Products, Sales, Customers)
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [customers, setCustomers] = useState([])
  const [actionBanner, setActionBanner] = useState('')
  const [actionError, setActionError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Filter States
  const [period, setPeriod] = useState('all_time')
  const [category, setCategory] = useState('all')
  const [productSearch, setProductSearch] = useState('')
  const [inventorySearch, setInventorySearch] = useState('')

  // Add Product Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Keyboards',
    price: '',
    cost_price: '',
    stock_quantity: '25',
    reorder_level: '15',
  })

  // Record Sale Form State
  const [newSale, setNewSale] = useState({
    product_id: '',
    customer_id: '',
    quantity: '1',
    payment_method: 'GCash',
    sale_date: new Date().toISOString().slice(0, 10),
  })

  const loadStoreLists = useCallback(async () => {
    const apiBase = getApiBase()
    try {
      const [prodRes, salesRes, custRes] = await Promise.all([
        fetch(`${apiBase}/api/products`),
        fetch(`${apiBase}/api/sales`),
        fetch(`${apiBase}/api/customers`),
      ])

      if (prodRes.ok) {
        const prodJson = await prodRes.json()
        const list = prodJson.products || []
        setProducts(list)
        setNewSale((prev) => ({
          ...prev,
          product_id: prev.product_id || (list[0]?.id ? String(list[0].id) : ''),
        }))
      }
      if (salesRes.ok) {
        const salesJson = await salesRes.json()
        setSales(salesJson.sales || [])
      }
      if (custRes.ok) {
        const custJson = await custRes.json()
        const list = custJson.customers || []
        setCustomers(list)
        setNewSale((prev) => ({
          ...prev,
          customer_id: prev.customer_id || (list[0]?.id ? String(list[0].id) : ''),
        }))
      }
    } catch {
      // Secondary lists will retry on next refresh or tab switch
    }
  }, [])

  const loadAnalytics = useCallback(async (p, c) => {
    const requestId = ++requestCounterRef.current
    const apiBase = getApiBase()

    const slowTimer = setTimeout(() => {
      if (requestId === requestCounterRef.current) {
        setLoadingMessage('Waking up the server... First load can take up to 50 seconds on the free plan.')
      }
    }, 4000)

    try {
      const json = await fetchWithRetry(
        `${apiBase}/api/analytics?period=${p}&category=${c}`,
        (msg) => {
          if (requestId === requestCounterRef.current) {
            setLoadingMessage(msg)
          }
        },
      )

      if (requestId === requestCounterRef.current) {
        setData(json)
        setError('')
      }
    } catch (err) {
      if (requestId === requestCounterRef.current) {
        setError(err.message || 'Unable to load analytics')
      }
    } finally {
      clearTimeout(slowTimer)
      if (requestId === requestCounterRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    const apiBase = getApiBase()
    const slowTimer = setTimeout(() => {
      if (active) {
        setLoadingMessage('Waking up the server... First load can take up to 50 seconds on the free plan.')
      }
    }, 4000)

    fetchWithRetry(`${apiBase}/api/analytics?period=all_time&category=all`, (msg) => {
      if (active) setLoadingMessage(msg)
    })
      .then((json) => {
        if (!active) return
        setData(json)
        setError('')
        loadStoreLists()
      })
      .catch((err) => {
        if (!active) return
        setError(err.message || 'Unable to load analytics')
      })
      .finally(() => {
        clearTimeout(slowTimer)
        if (active) setLoading(false)
      })

    return () => {
      active = false
      clearTimeout(slowTimer)
    }
  }, [loadStoreLists])

  function refreshAll(p = period, c = category) {
    setLoading(true)
    setError('')
    setLoadingMessage('Loading your business data...')
    loadAnalytics(p, c)
    loadStoreLists()
  }

  function handleFilterChange(newPeriod, newCategory) {
    setPeriod(newPeriod)
    setCategory(newCategory)
    setLoading(true)
    setError('')
    setLoadingMessage('Updating charts...')
    loadAnalytics(newPeriod, newCategory)
  }

  function switchPage(pageId) {
    setActivePage(pageId)
    setMenuOpen(false)
    setActionBanner('')
    setActionError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleAddProduct(event) {
    event.preventDefault()
    setSubmitting(true)
    setActionBanner('')
    setActionError('')

    try {
      const response = await fetch(`${getApiBase()}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: newProduct.name,
          category: newProduct.category,
          price: Number(newProduct.price),
          cost_price: newProduct.cost_price ? Number(newProduct.cost_price) : null,
          stock_quantity: Number(newProduct.stock_quantity),
          reorder_level: Number(newProduct.reorder_level || 15),
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.message || 'Could not add product')
      }

      setNewProduct({
        name: '',
        category: newProduct.category,
        price: '',
        cost_price: '',
        stock_quantity: '25',
        reorder_level: '15',
      })
      setActionBanner(`Added "${newProduct.name}"! Dashboard, Predictive, and Prescriptive numbers are updated.`)
      await Promise.all([loadStoreLists(), loadAnalytics(period, category)])
    } catch (err) {
      setActionError(err.message || 'Unable to add product')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRestock(productId, productName, qty = 20) {
    setActionBanner('')
    setActionError('')

    try {
      const response = await fetch(`${getApiBase()}/api/products/${productId}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ quantity: qty }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.message || 'Could not restock product')
      }

      setActionBanner(`Restocked "${productName}" (+${qty} units). New stock: ${json.new_stock}.`)
      await Promise.all([loadStoreLists(), loadAnalytics(period, category)])
    } catch (err) {
      setActionError(err.message || 'Unable to restock product')
    }
  }

  async function handleRecordSale(event) {
    event.preventDefault()
    setSubmitting(true)
    setActionBanner('')
    setActionError('')

    try {
      const response = await fetch(`${getApiBase()}/api/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          product_id: Number(newSale.product_id),
          customer_id: newSale.customer_id ? Number(newSale.customer_id) : null,
          quantity: Number(newSale.quantity),
          payment_method: newSale.payment_method,
          sale_date: newSale.sale_date,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        const firstValidationErr = json.errors ? Object.values(json.errors).flat()[0] : null
        throw new Error(firstValidationErr || json.message || 'Could not record sale')
      }

      setNewSale((prev) => ({ ...prev, quantity: '1' }))
      setActionBanner('Sale recorded! Revenue, stock, and forecasts are now updated.')
      await Promise.all([loadStoreLists(), loadAnalytics(period, category)])
    } catch (err) {
      setActionError(err.message || 'Unable to record sale')
    } finally {
      setSubmitting(false)
    }
  }

  const summary = data?.summary

  const monthlySales = (data?.monthly_sales || []).map((item) => ({
    ...item,
    month: new Date(`${item.month}-01T00:00:00`).toLocaleDateString(
      'en-US',
      { month: 'short', year: '2-digit' },
    ),
    revenue: Number(item.revenue),
  }))

  const topProducts = (data?.top_products || []).map((item) => ({
    ...item,
    revenue: Number(item.revenue),
    units_sold: Number(item.units_sold),
  }))

  const categories = (data?.sales_by_category || []).map((item) => ({
    ...item,
    revenue: Number(item.revenue),
  }))

  const filteredProducts = products.filter((item) => {
    const q = productSearch.toLowerCase()
    return (
      item.name.toLowerCase().includes(q)
      || item.category.toLowerCase().includes(q)
      || item.product_code.toLowerCase().includes(q)
    )
  })

  const filteredInventory = (data?.inventory_alerts || []).filter((item) => {
    const q = inventorySearch.toLowerCase()
    return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
  })

  const selectedSaleProduct = products.find((p) => String(p.id) === String(newSale.product_id))
  const estimatedSaleTotal = selectedSaleProduct
    ? Number(selectedSaleProduct.price) * Math.max(1, Number(newSale.quantity || 1))
    : 0

  const last3Months = data?.forecast?.last_3_months || []

  const pageHeaders = {
    overview: {
      eyebrow: 'STEP 1 · DESCRIPTIVE ANALYTICS',
      title: 'Business Overview',
      subtitle: 'Summary of past sales, revenue by category, and top products.',
    },
    products: {
      eyebrow: 'INVENTORY MANAGEMENT',
      title: 'Products & Stock',
      subtitle: 'Add new products, view stock levels, or restock items.',
    },
    sales: {
      eyebrow: 'TRANSACTION MANAGEMENT',
      title: 'Record & View Sales',
      subtitle: 'Record a new sale and watch revenue, stock, and analytics update automatically.',
    },
    predictive: {
      eyebrow: 'STEP 2 · PREDICTIVE ANALYTICS',
      title: 'Sales & Demand Forecast',
      subtitle: 'Estimates next month revenue and product demand from past sales records.',
    },
    prescriptive: {
      eyebrow: 'STEP 3 · PRESCRIPTIVE ANALYTICS',
      title: 'Recommended Actions',
      subtitle: 'Clear restock orders based on demand forecasts and safety stock.',
    },
  }

  const currentHeader = pageHeaders[activePage] || pageHeaders.overview

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">
            <ChartNoAxesCombined size={23} />
          </div>
          <div>
            <strong>SalesInsight</strong>
            <span>Business Analytics</span>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <p className="nav-label">ANALYTICS</p>

        <button
          type="button"
          className={`nav-link ${activePage === 'overview' ? 'active' : ''}`}
          onClick={() => switchPage('overview')}
        >
          <Activity size={18} /> Descriptive (Overview)
        </button>

        <button
          type="button"
          className={`nav-link ${activePage === 'predictive' ? 'active' : ''}`}
          onClick={() => switchPage('predictive')}
        >
          <TrendingUp size={18} /> Predictive Analytics
        </button>

        <button
          type="button"
          className={`nav-link ${activePage === 'prescriptive' ? 'active' : ''}`}
          onClick={() => switchPage('prescriptive')}
        >
          <Boxes size={18} /> Prescriptive Analytics
        </button>

        <p className="nav-label" style={{ marginTop: '18px' }}>MANAGE DATA</p>

        <button
          type="button"
          className={`nav-link ${activePage === 'products' ? 'active' : ''}`}
          onClick={() => switchPage('products')}
        >
          <Package size={18} /> Products & Stock
        </button>

        <button
          type="button"
          className={`nav-link ${activePage === 'sales' ? 'active' : ''}`}
          onClick={() => switchPage('sales')}
        >
          <ShoppingBag size={18} /> Record Sales
        </button>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <div>
            <strong>System online</strong>
            <span>Laravel + SQL</span>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="menu-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <main className="main-content" id="overview">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <div>
            <p className="eyebrow">{currentHeader.eyebrow}</p>
            <h1>{currentHeader.title}</h1>
          </div>

          <button
            className="refresh-button"
            onClick={() => refreshAll(period, category)}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            <span>{loading ? 'Loading...' : 'Refresh data'}</span>
          </button>
        </header>

        {/* 3-Step Business Analytics Page Switcher */}
        <div className="ba-workflow-bar">
          <button
            type="button"
            className={`ba-workflow-step-btn ${activePage === 'overview' ? 'is-active' : ''}`}
            onClick={() => switchPage('overview')}
          >
            <span className="ba-badge desc">Step 1: Descriptive</span>
            <span>What Happened (Sales & Ads)</span>
          </button>
          <span className="ba-arrow"><ArrowRight size={14} /></span>
          <button
            type="button"
            className={`ba-workflow-step-btn ${activePage === 'predictive' ? 'is-active' : ''}`}
            onClick={() => switchPage('predictive')}
          >
            <span className="ba-badge pred">Step 2: Predictive</span>
            <span>What Will Happen (Forecasts)</span>
          </button>
          <span className="ba-arrow"><ArrowRight size={14} /></span>
          <button
            type="button"
            className={`ba-workflow-step-btn ${activePage === 'prescriptive' ? 'is-active' : ''}`}
            onClick={() => switchPage('prescriptive')}
          >
            <span className="ba-badge presc">Step 3: Prescriptive</span>
            <span>What To Do (Restock & Ads)</span>
          </button>
        </div>

        <p className="page-subtitle">{currentHeader.subtitle}</p>

        {actionBanner && (
          <div className="success-banner">
            <CheckCircle2 size={18} />
            <span>{actionBanner}</span>
          </div>
        )}

        {actionError && (
          <div className="error-box" style={{ marginTop: 0, marginBottom: '18px' }}>
            <AlertTriangle size={20} />
            <div>
              <strong>Action failed</strong>
              <p>{actionError}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="error-box">
            <AlertTriangle size={20} />
            <div>
              <strong>Could not load analytics</strong>
              <p>
                {error}.{' '}
                {import.meta.env.DEV
                  ? 'Check that Laravel is running at port 8000.'
                  : 'The backend server may still be waking up. Wait a moment and click Try again.'}
              </p>
              <button onClick={() => refreshAll(period, category)}>Try again</button>
            </div>
          </div>
        )}

        {loading && !data ? (
          <div className="loading-box">{loadingMessage}</div>
        ) : data && (
          <>
            {/* ============================================================
                PAGE 1: DESCRIPTIVE ANALYTICS (OVERVIEW)
               ============================================================ */}
            {activePage === 'overview' && (
              <>
                <div className="welcome-row">
                  <div>
                    <h2>Business Performance Summary</h2>
                    <p>SalesInsight · Gadget & Electronics Store (Cebu)</p>
                  </div>
                  <span className="live-badge">
                    <span /> Live Database Connected
                  </span>
                </div>

                <div className="filter-controls">
                  <div className="filter-group">
                    <Filter size={15} color="#6366f1" />
                    <span>Date Period:</span>
                    <select
                      className="filter-select"
                      value={period}
                      onChange={(e) => handleFilterChange(e.target.value, category)}
                    >
                      <option value="all_time">All Time</option>
                      <option value="this_month">This Month</option>
                      <option value="last_month">Last Month</option>
                      <option value="this_year">This Year</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <span>Product Category:</span>
                    <select
                      className="filter-select"
                      value={category}
                      onChange={(e) => handleFilterChange(period, e.target.value)}
                    >
                      <option value="all">All Categories</option>
                      {PRESET_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="stats-grid">
                  <StatCard
                    title="Total revenue"
                    value={formatMoneyShort(summary.total_revenue)}
                    subtitle="Recorded sales total"
                    icon={PhilippinePeso}
                  />
                  <StatCard
                    title="Sales transactions"
                    value={Number(summary.total_sales).toLocaleString()}
                    subtitle="Completed orders"
                    icon={ShoppingBag}
                  />
                  <StatCard
                    title="Customers"
                    value={Number(summary.total_customers).toLocaleString()}
                    subtitle="Registered accounts"
                    icon={Users}
                  />
                  <StatCard
                    title="Products"
                    value={Number(summary.total_products).toLocaleString()}
                    subtitle="Items in catalog"
                    icon={Boxes}
                  />
                </div>

                <div className="chart-grid">
                  <Panel
                    title="Revenue over time"
                    subtitle="Monthly sales revenue trend"
                  >
                    {monthlySales.length ? (
                      <>
                        <ResponsiveContainer width="100%" height={260}>
                          <AreaChart
                            data={monthlySales}
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf4" />
                            <XAxis
                              dataKey="month"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: '#7b8498', fontSize: 12 }}
                            />
                            <YAxis
                              tickFormatter={(v) => `₱${Math.round(v / 1000)}k`}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: '#7b8498', fontSize: 12 }}
                              width={55}
                            />
                            <Tooltip formatter={(v) => formatMoneyShort(v)} />
                            <Area
                              type="monotone"
                              dataKey="revenue"
                              name="Revenue"
                              stroke="#6366f1"
                              strokeWidth={3}
                              fill="url(#revenueFill)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        <p className="chart-explanation">
                          <strong>Insight:</strong> {data?.insights?.monthly_sales}
                        </p>
                      </>
                    ) : (
                      <p className="empty-state">No monthly sales data for this filter.</p>
                    )}
                  </Panel>

                  <Panel
                    title="Revenue by category"
                    subtitle="How much each product category earned"
                  >
                    {categories.length ? (
                      <>
                        <ResponsiveContainer width="100%" height={260}>
                          <PieChart>
                            <Pie
                              data={categories}
                              dataKey="revenue"
                              nameKey="category"
                              cx="50%"
                              cy="48%"
                              innerRadius={55}
                              outerRadius={88}
                              paddingAngle={4}
                            >
                              {categories.map((entry, index) => (
                                <Cell key={entry.category} fill={colors[index % colors.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => formatMoneyShort(v)} />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                        <p className="chart-explanation">
                          <strong>Insight:</strong> {data?.insights?.category}
                        </p>
                      </>
                    ) : (
                      <p className="empty-state">No category data for this filter.</p>
                    )}
                  </Panel>
                </div>

                <div className="chart-grid single">
                  <Panel
                    title="Top-performing products"
                    subtitle="Top 5 products by total sales revenue"
                  >
                    {topProducts.length ? (
                      <>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart
                            data={topProducts}
                            layout="vertical"
                            margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e9edf4" />
                            <XAxis
                              type="number"
                              tickFormatter={(v) => `₱${Math.round(v / 1000)}k`}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={140}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 10 }}
                            />
                            <Tooltip formatter={(v) => formatMoneyShort(v)} />
                            <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        <p className="chart-explanation">
                          <strong>Insight:</strong> {data?.insights?.top_products}
                        </p>
                      </>
                    ) : (
                      <p className="empty-state">No products found for this filter.</p>
                    )}
                  </Panel>
                </div>
              </>
            )}

            {/* ============================================================
                PAGE 2: PREDICTIVE ANALYTICS
               ============================================================ */}
            {activePage === 'predictive' && (
              <>
                <div className="concept-card pred">
                  <TrendingUp size={20} />
                  <div>
                    <strong>How Predictive Analytics Works Here</strong>
                    <p>
                      Predictive analytics uses your past sales numbers to <strong>estimate</strong> future revenue and product demand.
                      It gives forecasts (not commands yet).
                    </p>
                  </div>
                </div>

                <div className="bottom-grid">
                  <Panel
                    title="Monthly Revenue Forecast"
                    subtitle="Formula: (Month 1 + Month 2 + Month 3) ÷ 3"
                  >
                    <div className="forecast-card">
                      <div className="forecast-icon">
                        <TrendingUp size={22} />
                      </div>
                      <p>Estimated Next Month Revenue</p>
                      <h2>{formatMoneyShort(data.forecast?.estimated_monthly_revenue)}</h2>
                      <span>Based on 3-Month Moving Average</span>
                    </div>

                    {last3Months.length > 0 && (
                      <div className="math-breakdown">
                        <strong>Step-by-Step Calculation:</strong>
                        <ul>
                          {last3Months.map((m) => (
                            <li key={m.month}>
                              <span>{m.month}</span>
                              <strong>{formatMoneyShort(m.revenue)}</strong>
                            </li>
                          ))}
                        </ul>
                        <div className="math-total">
                          <span>Average of these {last3Months.length} month(s):</span>
                          <strong>{formatMoneyShort(data.forecast?.estimated_monthly_revenue)}</strong>
                        </div>
                      </div>
                    )}
                  </Panel>

                  <Panel
                    title="Product Demand Forecast"
                    subtitle="Formula: Total Past Units Sold ÷ Active Months"
                  >
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Product Name</th>
                            <th>Category</th>
                            <th>Past Units Sold</th>
                            <th>Est. Monthly Demand</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.product_demand_forecast || []).map((p, idx) => (
                            <tr key={idx}>
                              <td><strong>{p.product_name}</strong></td>
                              <td>{p.category}</td>
                              <td>{p.previous_sales_qty} units</td>
                              <td>
                                <strong style={{ color: '#6366f1' }}>
                                  ~{p.estimated_monthly_demand} units/mo
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="chart-explanation">
                      <strong>How to read this:</strong> If a product sold 10 units across 6 active months, the store expects roughly 2 units sold next month.
                    </p>
                  </Panel>
                </div>
              </>
            )}

            {/* ============================================================
                PAGE 3: PRESCRIPTIVE ANALYTICS
               ============================================================ */}
            {activePage === 'prescriptive' && (
              <>
                <div className="concept-card presc">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>How Prescriptive Analytics Works Here</strong>
                    <p>
                      Prescriptive analytics turns forecasts into <strong>exact actions</strong>: which items to restock today, how many units to order
                      (<code>Predicted Demand + Safety Stock - Current Stock</code>).
                    </p>
                  </div>
                </div>

                <div className="stats-grid stats-grid-3">
                  <StatCard
                    title="Products Monitored"
                    value={Number(summary.total_products).toLocaleString()}
                    subtitle="Total catalog items tracked"
                    icon={Package}
                  />
                  <StatCard
                    title="Low-Stock Products"
                    value={Number(summary.low_stock_products).toLocaleString()}
                    subtitle="At or below safety reorder level"
                    icon={AlertTriangle}
                  />
                  <StatCard
                    title="Out-of-Stock Products"
                    value={Number(summary.out_of_stock_products || 0).toLocaleString()}
                    subtitle="Currently 0 units left"
                    icon={Boxes}
                  />
                </div>

                <Panel
                  title="Recommended Inventory Restock Actions"
                  subtitle="Items below their safety stock level (click Restock to replenish immediately)"
                >
                  <div className="table-toolbar">
                    <input
                      type="text"
                      className="table-search-input"
                      placeholder="Search product or category..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                    />
                  </div>

                  {filteredInventory.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Product Name</th>
                            <th>Current Stock</th>
                            <th>Safety Stock</th>
                            <th>3-Mo Demand</th>
                            <th>Suggested Order</th>
                            <th>Why / Action</th>
                            <th>Quick Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInventory.map((item, index) => (
                            <tr key={`${item.name}-${index}`}>
                              <td>
                                <strong>{item.name}</strong>
                                <div className="sub-cell">{item.category}</div>
                              </td>
                              <td>
                                <span className={`stock-pill ${item.stock_quantity === 0 ? 'danger' : ''}`}>
                                  {item.stock_quantity}
                                </span>
                              </td>
                              <td>{item.reorder_level}</td>
                              <td>{item.predicted_demand}</td>
                              <td>
                                <strong style={{ color: '#059669' }}>
                                  +{item.suggested_reorder} units
                                </strong>
                              </td>
                              <td className="wrap-cell">{item.recommendation}</td>
                              <td>
                                {item.product_id && (
                                  <button
                                    type="button"
                                    className="mini-action-btn"
                                    onClick={() => handleRestock(item.product_id, item.name, item.suggested_reorder)}
                                  >
                                    Restock +{item.suggested_reorder}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty-state">All products are currently above their safety stock level!</p>
                  )}
                </Panel>

                <div className="prescriptive-summary-card">
                  <CheckCircle2 size={20} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Recommended Business Decision</strong>
                    <p>
                      <strong>Inventory Optimization:</strong> {data?.prescriptive?.inventory_advice}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ============================================================
                PAGE 4: PRODUCTS & STOCK MANAGEMENT
               ============================================================ */}
            {activePage === 'products' && (
              <>
                <Panel
                  title="Add New Product"
                  subtitle="Add an item to your store inventory — try setting Stock below Safety Stock to trigger a Prescriptive alert!"
                >
                  <form className="crud-form" onSubmit={handleAddProduct}>
                    <label>
                      <span>Product Name *</span>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. Anker USB-C Fast Charger"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      />
                    </label>

                    <label>
                      <span>Category *</span>
                      <select
                        className="form-input"
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      >
                        {PRESET_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Selling Price (₱) *</span>
                      <input
                        type="number"
                        required
                        min="1"
                        step="0.01"
                        className="form-input"
                        placeholder="599"
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      />
                    </label>

                    <label>
                      <span>Initial Stock *</span>
                      <input
                        type="number"
                        required
                        min="0"
                        className="form-input"
                        value={newProduct.stock_quantity}
                        onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
                      />
                    </label>

                    <label>
                      <span>Safety Stock (Reorder Level)</span>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={newProduct.reorder_level}
                        onChange={(e) => setNewProduct({ ...newProduct, reorder_level: e.target.value })}
                      />
                    </label>

                    <div className="form-submit-wrap">
                      <button type="submit" className="primary-btn" disabled={submitting}>
                        <PlusCircle size={16} />
                        <span>{submitting ? 'Saving...' : 'Add Product'}</span>
                      </button>
                    </div>
                  </form>
                </Panel>

                <Panel
                  title={`Product List (${filteredProducts.length})`}
                  subtitle="All products currently stored in the database"
                  className="panel-spaced"
                >
                  <div className="table-toolbar">
                    <input
                      type="text"
                      className="table-search-input"
                      placeholder="Search by code, product name, or category..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Price</th>
                          <th>Stock</th>
                          <th>Safety Level</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((p) => (
                          <tr key={p.id}>
                            <td>{p.product_code}</td>
                            <td><strong>{p.name}</strong></td>
                            <td>{p.category}</td>
                            <td>{formatMoney(p.price)}</td>
                            <td>{p.stock_quantity}</td>
                            <td>{p.reorder_level}</td>
                            <td>
                              <span
                                className={`status-badge ${
                                  p.status === 'Out of Stock'
                                    ? 'danger'
                                    : p.status === 'Low Stock'
                                      ? 'warn'
                                      : 'ok'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="mini-action-btn"
                                onClick={() => handleRestock(p.id, p.name, 20)}
                              >
                                + Restock 20
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )}

            {/* ============================================================
                PAGE 5: RECORD & VIEW SALES
               ============================================================ */}
            {activePage === 'sales' && (
              <>
                <Panel
                  title="Record New Sale"
                  subtitle="Recording a sale automatically adds revenue and subtracts the sold quantity from stock"
                >
                  <form className="crud-form" onSubmit={handleRecordSale}>
                    <label>
                      <span>Product *</span>
                      <select
                        className="form-input"
                        required
                        value={newSale.product_id}
                        onChange={(e) => setNewSale({ ...newSale, product_id: e.target.value })}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatMoneyShort(p.price)} · {p.stock_quantity} in stock)
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Customer</span>
                      <select
                        className="form-input"
                        value={newSale.customer_id}
                        onChange={(e) => setNewSale({ ...newSale, customer_id: e.target.value })}
                      >
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name} ({c.city})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Quantity *</span>
                      <input
                        type="number"
                        required
                        min="1"
                        max={selectedSaleProduct ? Math.max(1, selectedSaleProduct.stock_quantity) : 1000}
                        className="form-input"
                        value={newSale.quantity}
                        onChange={(e) => setNewSale({ ...newSale, quantity: e.target.value })}
                      />
                    </label>

                    <label>
                      <span>Payment Method *</span>
                      <select
                        className="form-input"
                        value={newSale.payment_method}
                        onChange={(e) => setNewSale({ ...newSale, payment_method: e.target.value })}
                      >
                        <option value="GCash">GCash</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Maya">Maya</option>
                      </select>
                    </label>

                    <label>
                      <span>Sale Date *</span>
                      <input
                        type="date"
                        required
                        className="form-input"
                        value={newSale.sale_date}
                        onChange={(e) => setNewSale({ ...newSale, sale_date: e.target.value })}
                      />
                    </label>

                    <div className="form-submit-wrap">
                      <div className="sale-preview">
                        Total: <strong>{formatMoney(estimatedSaleTotal)}</strong>
                      </div>
                      <button type="submit" className="primary-btn" disabled={submitting || !products.length}>
                        <PlusCircle size={16} />
                        <span>{submitting ? 'Recording...' : 'Record Sale'}</span>
                      </button>
                    </div>
                  </form>
                </Panel>

                <Panel
                  title={`Recent Sales Transactions (${sales.length})`}
                  subtitle="Most recent recorded customer orders"
                  className="panel-spaced"
                >
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Date</th>
                          <th>Product</th>
                          <th>Customer</th>
                          <th>Qty</th>
                          <th>Total Amount</th>
                          <th>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((s) => (
                          <tr key={s.id}>
                            <td>{s.transaction_code}</td>
                            <td>{s.sale_date}</td>
                            <td><strong>{s.product_name}</strong></td>
                            <td>{s.customer_name}</td>
                            <td>{s.quantity}</td>
                            <td><strong>{formatMoney(s.total_amount)}</strong></td>
                            <td>{s.payment_method}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )}
          </>
        )}

        <footer>
          SalesInsight · Business Intelligence Dashboard · Laravel + React + SQL
        </footer>
      </main>
    </div>
  )
}
