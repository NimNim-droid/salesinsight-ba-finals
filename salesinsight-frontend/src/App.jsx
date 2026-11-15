import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Activity, Boxes, Users, PhilippinePeso, ShoppingBag,
  AlertTriangle, RefreshCw, TrendingUp, Menu, X,
  ChartNoAxesCombined, Megaphone, Package, CheckCircle2,
  Filter, Search, ArrowRight,
} from 'lucide-react'
import './App.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']

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

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  // Interactive Filter States
  const [period, setPeriod] = useState('all_time')
  const [category, setCategory] = useState('all')
  const [inventorySearch, setInventorySearch] = useState('')

  // Interactive Marketing Simulator States
  const [simPlatform, setSimPlatform] = useState('TikTok')
  const [simBudget, setSimBudget] = useState(15000)

  async function loadAnalytics(p = period, c = category) {
    setLoading(true)
    setError('')

    try {
      const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
      const response = await fetch(`${apiBase}/api/analytics?period=${p}&category=${c}`)
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }
      const json = await response.json()
      setData(json)
    } catch (err) {
      setError(err.message || 'Unable to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  function handleFilterChange(newPeriod, newCategory) {
    setPeriod(newPeriod)
    setCategory(newCategory)
    loadAnalytics(newPeriod, newCategory)
  }

  function handleNavigation(event, sectionId) {
    event.preventDefault()
    setMenuOpen(false)

    if (window.location.hash !== `#${sectionId}`) {
      window.history.pushState(null, '', `#${sectionId}`)
    }

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  useEffect(() => {
    function scrollToHash() {
      const sectionId = window.location.hash.slice(1)
      if (!sectionId) return

      requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    }

    scrollToHash()
    window.addEventListener('hashchange', scrollToHash)

    return () => {
      window.removeEventListener('hashchange', scrollToHash)
    }
  }, [data])

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

  const marketing = (data?.marketing_by_platform || []).map((item) => ({
    ...item,
    conversions: Number(item.conversions),
    clicks: Number(item.clicks),
    total_spend: Number(item.total_spend),
    cost_per_conversion: Number(item.cost_per_conversion || 0),
  }))

  // Simulator Calculation
  const selectedPlatformData = marketing.find((m) => m.platform === simPlatform) || marketing[0]
  const platformCpa = selectedPlatformData?.cost_per_conversion || 46.48
  const simEstimatedBuyers = simBudget > 0 && platformCpa > 0 ? Math.round(simBudget / platformCpa) : 0

  // Filtered Inventory List
  const filteredInventory = (data?.inventory_alerts || []).filter((item) => {
    const q = inventorySearch.toLowerCase()
    return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
  })

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

        <p className="nav-label">WORKSPACE</p>

        <a
          className="nav-link active"
          href="#overview"
          onClick={(event) => handleNavigation(event, 'overview')}
        >
          <Activity size={18} /> Overview
        </a>

        <a
          className="nav-link"
          href="#sales"
          onClick={(event) => handleNavigation(event, 'step-descriptive')}
        >
          <TrendingUp size={18} /> Sales analytics
        </a>

        <a
          className="nav-link"
          href="#products"
          onClick={(event) => handleNavigation(event, 'products')}
        >
          <Package size={18} /> Products
        </a>

        <a
          className="nav-link"
          href="#marketing"
          onClick={(event) => handleNavigation(event, 'marketing')}
        >
          <Megaphone size={18} /> Marketing
        </a>

        <a
          className="nav-link"
          href="#inventory"
          onClick={(event) => handleNavigation(event, 'step-prescriptive')}
        >
          <Boxes size={18} /> Inventory
        </a>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <div>
            <strong>System online</strong>
            <span>Laravel + MySQL</span>
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
            <p className="eyebrow">YOUR BUSINESS AT A GLANCE</p>
            <h1>Analytics Overview</h1>
          </div>

          <button
            className="refresh-button"
            onClick={() => loadAnalytics(period, category)}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? 'spinning' : ''}
            />
            <span>{loading ? 'Loading...' : 'Refresh data'}</span>
          </button>
        </header>

        {error && (
          <div className="error-box">
            <AlertTriangle size={20} />
            <div>
              <strong>Could not load analytics</strong>
              <p>{error}. Check that Laravel is running at port 8000.</p>
              <button onClick={() => loadAnalytics(period, category)}>Try again</button>
            </div>
          </div>
        )}

        {loading && !data ? (
          <div className="loading-box">Loading your business data from MySQL...</div>
        ) : data && (
          <>
            {/* Business Analytics 3-Step Process Connection Banner (Interactive) */}
            <div className="ba-workflow-bar">
              <button
                className="ba-workflow-step-btn"
                onClick={(e) => handleNavigation(e, 'step-descriptive')}
                title="Click to jump to Step 1: Descriptive Analytics"
              >
                <span className="ba-badge desc">Step 1: Descriptive</span>
                <span>Analyze Past Sales & Costs</span>
              </button>
              <span className="ba-arrow"><ArrowRight size={14} /></span>
              <button
                className="ba-workflow-step-btn"
                onClick={(e) => handleNavigation(e, 'step-predictive')}
                title="Click to jump to Step 2: Predictive Analytics"
              >
                <span className="ba-badge pred">Step 2: Predictive</span>
                <span>Forecast Revenue & Demand</span>
              </button>
              <span className="ba-arrow"><ArrowRight size={14} /></span>
              <button
                className="ba-workflow-step-btn"
                onClick={(e) => handleNavigation(e, 'step-prescriptive')}
                title="Click to jump to Step 3: Prescriptive Analytics"
              >
                <span className="ba-badge presc">Step 3: Prescriptive</span>
                <span>Reorder Stock & Allocate Ads</span>
              </button>
            </div>

            {/* Welcome & Store Overview */}
            <div className="welcome-row">
              <div>
                <h2>Business Performance & Analytics Overview</h2>
                <p>SalesInsight · Gadget & Electronics Store (Cebu) | Case Study Decision Dashboard</p>
              </div>
              <span className="live-badge">
                <span /> Connected to MySQL (50+ Records per Category)
              </span>
            </div>

            {/* Interactive Filters Bar */}
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
                  <option value="Keyboards">Keyboards</option>
                  <option value="Chargers">Chargers</option>
                  <option value="Audio">Audio</option>
                  <option value="Phone Cases">Phone Cases</option>
                  <option value="Accessories">Accessories</option>
                </select>
              </div>
            </div>

            {/* KPI Stat Cards */}
            <div className="stats-grid">
              <StatCard
                title="Total revenue"
                value={formatMoney(summary.total_revenue)}
                subtitle="All recorded sales"
                icon={PhilippinePeso}
              />
              <StatCard
                title="Sales transactions"
                value={Number(summary.total_sales).toLocaleString()}
                subtitle="Customer orders"
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
                subtitle="Catalog items"
                icon={Boxes}
              />
            </div>

            {/* STEP 1: DESCRIPTIVE CHARTS ROW 1 */}
            <div className="chart-grid" id="step-descriptive">
              <Panel
                title="Revenue over time"
                subtitle="[Step 1: Descriptive] Monthly sales revenue trend"
              >
                {monthlySales.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart
                        data={monthlySales}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="revenueFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e9edf4"
                        />
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
                        <Tooltip formatter={(v) => formatMoney(v)} />
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
                      💡 <strong>Insight:</strong> {data?.insights?.monthly_sales}
                    </p>
                  </>
                ) : (
                  <p className="empty-state">No monthly sales data for this filter.</p>
                )}
              </Panel>

              <Panel
                title="Revenue by category"
                subtitle="[Step 1: Descriptive] Category contribution share"
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
                            <Cell
                              key={entry.category}
                              fill={colors[index % colors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatMoney(v)} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                    <p className="chart-explanation">
                      💡 <strong>Insight:</strong> {data?.insights?.category}
                    </p>
                  </>
                ) : (
                  <p className="empty-state">No category data for this filter.</p>
                )}
              </Panel>
            </div>

            {/* STEP 1: DESCRIPTIVE CHARTS ROW 2 */}
            <div className="chart-grid" id="products">
              <Panel
                title="Top-performing products"
                subtitle="[Step 1: Descriptive] Top 5 products by revenue"
              >
                {topProducts.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={topProducts}
                        layout="vertical"
                        margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="#e9edf4"
                        />
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
                        <Tooltip formatter={(v) => formatMoney(v)} />
                        <Bar
                          dataKey="revenue"
                          name="Revenue"
                          fill="#6366f1"
                          radius={[0, 6, 6, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="chart-explanation">
                      💡 <strong>Insight:</strong> {data?.insights?.top_products}
                    </p>
                  </>
                ) : (
                  <p className="empty-state">No products found for this filter.</p>
                )}
              </Panel>

              <Panel
                id="marketing"
                title="Marketing performance"
                subtitle="[Step 1: Descriptive] Campaign results & cost per buyer"
                className="marketing-panel"
              >
                {marketing.length ? (
                  <>
                    <div className="marketing-list">
                      {marketing.map((item, index) => (
                        <div className="marketing-item" key={item.platform}>
                          <div
                            className="marketing-rank"
                            style={{
                              background: `${colors[index % colors.length]}18`,
                              color: colors[index % colors.length],
                            }}
                          >
                            {index + 1}
                          </div>

                          <div className="marketing-info">
                            <div className="marketing-title">
                              <strong>
                                {item.platform}{' '}
                                {index === 0 && (
                                  <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 700 }}>
                                    ★ Best ROI
                                  </span>
                                )}
                              </strong>
                              <span>{item.conversions} buyers (₱{item.cost_per_conversion} / buyer)</span>
                            </div>

                            <div className="progress-track">
                              <div
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (item.conversions /
                                      Math.max(
                                        ...marketing.map((m) => m.conversions),
                                        1,
                                      )) *
                                    100,
                                  )
                                    }%`,
                                  background: colors[index % colors.length],
                                }}
                              />
                            </div>

                            <small>
                              {item.clicks.toLocaleString()} clicks · Spend{' '}
                              {formatMoney(item.total_spend)}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="chart-explanation">
                      💡 <strong>Insight:</strong> {data?.insights?.marketing}
                    </p>
                  </>
                ) : (
                  <p className="empty-state">No marketing data yet.</p>
                )}
              </Panel>
            </div>

            {/* STEP 2: PREDICTIVE ANALYTICS ROW */}
            <div className="bottom-grid" id="step-predictive">
              <Panel
                title="Revenue forecast"
                subtitle="[Step 2: Predictive] 3-Month Moving Average forecast"
              >
                <div className="forecast-card">
                  <div className="forecast-icon">
                    <TrendingUp size={22} />
                  </div>
                  <p>Estimated monthly revenue</p>
                  <h2>
                    {formatMoney(data.forecast?.estimated_monthly_revenue)}
                  </h2>
                  <span>
                    Formula: (Month 1 + Month 2 + Month 3) / 3
                  </span>
                </div>

                <div className="forecast-note">
                  <Activity size={17} />
                  <p>
                    {data.forecast?.explanation} This baseline moving average supports proactive purchasing without complex algorithms.
                  </p>
                </div>

                {/* Interactive What-If Simulator */}
                <div style={{ marginTop: '16px', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <strong style={{ fontSize: '12px', display: 'block', marginBottom: '8px', color: '#1e293b' }}>
                    🎮 Interactive Marketing Simulator (What-If Spend)
                  </strong>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Platform:</span>
                    <select
                      className="filter-select"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      value={simPlatform}
                      onChange={(e) => setSimPlatform(e.target.value)}
                    >
                      {marketing.map((m) => (
                        <option key={m.platform} value={m.platform}>
                          {m.platform} (₱{m.cost_per_conversion} / buyer)
                        </option>
                      ))}
                    </select>

                    <span style={{ fontSize: '11px', color: '#64748b' }}>Budget (₱):</span>
                    <input
                      type="number"
                      step="1000"
                      min="1000"
                      max="100000"
                      value={simBudget}
                      onChange={(e) => setSimBudget(Number(e.target.value))}
                      style={{ width: '85px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: '#047857', fontWeight: 700 }}>
                    → Estimated: ≈ {simEstimatedBuyers.toLocaleString()} new buyers on {simPlatform}
                  </div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                    *Simulation based on historical cost per buyer (Budget ÷ CPA). Not a guaranteed outcome.
                  </span>
                </div>
              </Panel>

              {/* Requirement 5B: Product Demand Forecast Panel */}
              <Panel
                title="Product demand forecast"
                subtitle="[Step 2: Predictive] Next month estimated unit demand"
              >
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Category</th>
                        <th>Past Sales</th>
                        <th>Est. Next Month</th>
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
                <p className="chart-explanation" style={{ marginTop: '10px' }}>
                  💡 <strong>Demand Insight:</strong> Top items average 2-4 units sold monthly per Cebu store branch.
                </p>
              </Panel>
            </div>

            {/* STEP 3: PRESCRIPTIVE INVENTORY RECOMMENDATIONS */}
            <div id="step-prescriptive" style={{ marginTop: '20px' }}>
              <Panel
                title="Inventory alerts & reorder recommendations"
                subtitle="[Step 3: Prescriptive] Stockout prevention decision support"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                  <div className="inventory-summary" style={{ margin: 0, padding: '10px 14px' }}>
                    <div className="inventory-alert-icon" style={{ width: '32px', height: '32px' }}>
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '16px' }}>{summary.low_stock_products}</strong>
                      <span style={{ fontSize: '10px' }}>Products below reorder level</span>
                    </div>
                  </div>

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
                          <th>Category</th>
                          <th>Stock</th>
                          <th>Safety Stock</th>
                          <th>Pred. Demand</th>
                          <th>Suggested Order</th>
                          <th>Action Recommendation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventory.map((item, index) => (
                          <tr key={`${item.name}-${index}`}>
                            <td><strong>{item.name}</strong></td>
                            <td>{item.category}</td>
                            <td>
                              <span className="stock-pill">
                                {item.stock_quantity}
                              </span>
                            </td>
                            <td>{item.reorder_level}</td>
                            <td>{item.predicted_demand || 10}</td>
                            <td>
                              <strong style={{ color: '#10b981' }}>
                                +{item.suggested_reorder} units
                              </strong>
                            </td>
                            <td style={{ fontSize: '11px', color: '#475569' }}>
                              {item.recommendation}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="empty-state">
                    No matching inventory alerts found.
                  </p>
                )}
              </Panel>
            </div>

            {/* Prescriptive Strategic Conclusion Card */}
            <div style={{ marginTop: '18px', marginBottom: '24px', padding: '16px 20px', background: '#ecfdf5', borderRadius: '12px', border: '1px solid #a7f3d0', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={20} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '13px', color: '#065f46', display: 'block', marginBottom: '3px' }}>
                  Step 3: Prescriptive Analytics & Decision Recommendation
                </strong>
                <p style={{ fontSize: '12px', color: '#047857', margin: 0, lineHeight: 1.5 }}>
                  1. <strong>Marketing Optimization:</strong> {data?.prescriptive?.marketing_advice}<br />
                  2. <strong>Inventory Optimization:</strong> {data?.prescriptive?.inventory_advice} Formula used: <code>Suggested Order = Max(0, Predicted Demand + Safety Stock - Current Stock)</code>.
                </p>
              </div>
            </div>
          </>
        )}

        <footer>
          SalesInsight · Business Intelligence Dashboard · Laravel + React + MySQL
        </footer>
      </main>
    </div>
  )
}
